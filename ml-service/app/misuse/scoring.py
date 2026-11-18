"""
Misuse scoring: the three saved models + the alert rules, as in section 7.4 / 8 of
ml-training/notebooks/01_misuse_training.ipynb.

    Random Forest            -> misuse type + confidence (main detector)
    data Isolation Forest    -> unusual data use (3-day average)
    call/SMS Isolation Forest -> unusual calling/SMS (3-day average)

Alert level per SIM-day, first rule that matches:
    High                RF says misuse AND data IF unusual
    Alert               RF says misuse
    Review              RF says normal AND data IF above its strict threshold
    Review (calls/SMS)  RF says normal AND call/SMS IF above its threshold
"""
from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn

from .features import DAILY_COLUMNS, EVENT_COLUMNS, build_all_features, prepare_call_events

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
ALERT_LEVELS = ["High", "Alert", "Review", "Review (calls/SMS)"]


class ModelsNotAvailable(RuntimeError):
    """The model files are missing or cannot be loaded."""


class BadInput(ValueError):
    """The request data cannot be scored."""


@dataclass
class LoadedModels:
    meta: dict
    rf: object
    data_iso: object
    call_iso: object


_lock = threading.Lock()
_models: LoadedModels | None = None


def load_models(models_dir: Path = MODELS_DIR) -> LoadedModels:
    """Load the models once (thread-safe) and keep them in memory."""
    global _models
    with _lock:
        if _models is not None:
            return _models
        meta_path = models_dir / "model_metadata.json"
        if not meta_path.exists():
            raise ModelsNotAvailable(
                f"{meta_path} not found. Run ml-training/notebooks/01_misuse_training.ipynb (section 8) to create the models.")
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        trained_with = meta["library_versions"]["scikit-learn"]
        if trained_with != sklearn.__version__:
            raise ModelsNotAvailable(
                f"Models were saved with scikit-learn {trained_with}, but this service has {sklearn.__version__}. "
                "Install the same version or retrain.")
        m = meta["models"]
        try:
            loaded = LoadedModels(
                meta=meta,
                rf=joblib.load(models_dir / m["random_forest"]["file"]),
                data_iso=joblib.load(models_dir / m["data_isolation_forest"]["file"]),
                call_iso=joblib.load(models_dir / m["call_sms_isolation_forest"]["file"]),
            )
        except FileNotFoundError as exc:
            raise ModelsNotAvailable(f"Model file missing: {exc.filename}") from exc
        for key, model in [("random_forest", loaded.rf), ("data_isolation_forest", loaded.data_iso),
                           ("call_sms_isolation_forest", loaded.call_iso)]:
            cols = meta["features"][m[key]["features"]]
            if list(model.feature_names_in_) != cols:
                raise ModelsNotAvailable(f"{key}: feature list does not match model_metadata.json")
        _models = loaded
        return _models


def model_info() -> dict:
    meta = load_models().meta
    m = meta["models"]
    return {
        "model_version": meta["model_version"],
        "created": meta["created"],
        "training_data": meta["training_data"],
        "misuse_types": [c for c in m["random_forest"]["classes"] if c != "normal"],
        "features": {k: len(v) for k, v in meta["features"].items()},
        "thresholds": {"data_isolation_forest": m["data_isolation_forest"]["thresholds"],
                       "call_sms_isolation_forest": m["call_sms_isolation_forest"]["thresholds"]},
        "smooth_window_days": m["data_isolation_forest"]["smooth_window_days"],
        "alert_rules": meta["alert_rules"],
        "history_needed_to_score_one_day": meta["history_needed_to_score_one_day"],
    }


def _smooth(scores: np.ndarray, sim: np.ndarray, date: np.ndarray, window: int) -> np.ndarray:
    """Mean of each SIM's score over today and the previous window-1 days (past days only)."""
    s = pd.DataFrame({"score": scores, "sim": sim, "date": date})
    s = s.sort_values(["sim", "date"])
    s["smoothed"] = s.groupby("sim")["score"].transform(lambda x: x.rolling(window, min_periods=1).mean())
    return s["smoothed"].sort_index().to_numpy()


# Plain-language signals shown to operators. They describe what is unusual about the day; they are
# not how the models decide (each signal is a fixed rule on one feature).
def _signals(row: pd.Series) -> list[str]:
    out = []
    if row["billed_minus_used_mb"] > 1:
        out.append(f"Billed {row['billed_minus_used_mb']:,.0f} MB more than was used")
    if row["total_mb_vs_longterm"] >= 2:
        out.append(f"Data use {row['total_mb_vs_longterm']:.1f}x its usual level ({row['total_mb']:,.0f} MB)")
    elif row["total_mb_vs_longterm"] <= 0.2 and row["total_mb"] < 50:
        out.append(f"Data use down to {row['total_mb']:,.0f} MB ({row['total_mb_vs_longterm']:.0%} of usual)")
    if row["hotspot_share"] >= 0.1:
        out.append(f"Hotspot on {row['hotspot_share']:.0%} of sessions")
    if row["offpeak_share"] >= 0.4 and row["total_mb"] >= 1:
        out.append(f"{row['offpeak_share']:.0%} of data used off-peak (10 pm - 7 am)")
    if row["calls"] >= 10 and row["new_call_share"] >= 0.5:
        out.append(f"{row['calls']:.0f} calls, {row['new_call_share']:.0%} to numbers never called before")
    elif row["calls_vs_longterm"] >= 3:
        out.append(f"{row['calls']:.0f} calls ({row['calls_vs_longterm']:.1f}x usual)")
    if row["call_minutes_vs_longterm"] >= 3:
        out.append(f"{row['call_minutes']:.0f} call minutes ({row['call_minutes_vs_longterm']:.1f}x usual), "
                   f"average call {row['mean_call_s'] / 60:.1f} min")
    if row["intl_call_share"] > 0:
        out.append(f"{row['intl_call_share']:.0%} of calls to international numbers")
    if row["sms"] >= 10 and row["new_sms_share"] >= 0.5:
        out.append(f"{row['sms']:.0f} SMS, {row['new_sms_share']:.0%} to new numbers")
    elif row["sms_vs_longterm"] >= 3:
        out.append(f"{row['sms']:.0f} SMS ({row['sms_vs_longterm']:.1f}x usual)")
    return out[:4]


def _check_columns(df: pd.DataFrame, required: list[str], what: str) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise BadInput(f"{what} is missing columns: {', '.join(missing)}")


def score(daily: pd.DataFrame, events: pd.DataFrame, score_from: str | None = None,
          alerts_only: bool = True) -> pd.DataFrame:
    """
    Score SIM-days.

    daily  : one row per SIM per day (DAILY_COLUMNS), INCLUDING the SIM's earlier days: they are needed
             for the baselines and the 3-day average. Up to 90 days of history gives the same features
             as training.
    events : the same SIMs' voice/SMS events (EVENT_COLUMNS) over the same days; data events are ignored.
    score_from : only return days on or after this date (YYYY-MM-DD); earlier days are history only.
    """
    models = load_models()
    meta = models.meta
    _check_columns(daily, DAILY_COLUMNS, "daily")
    _check_columns(events, EVENT_COLUMNS, "events")
    if daily.empty:
        raise BadInput("daily is empty")

    daily = daily.copy()
    daily["date"] = pd.to_datetime(daily["date"]).dt.strftime("%Y-%m-%d")
    if daily.duplicated(["sim_id", "date"]).any():
        raise BadInput("daily has more than one row for the same sim_id and date")
    daily = daily.sort_values(["sim_id", "date"]).reset_index(drop=True)
    unknown_sims = set(events["sim_id"]) - set(daily["sim_id"])
    if unknown_sims:
        raise BadInput(f"events contain sim_id values with no daily rows: {sorted(unknown_sims)[:5]}")

    X = build_all_features(daily, prepare_call_events(events))
    f = meta["features"]
    m = meta["models"]
    sim, date = daily["sim_id"].to_numpy(), daily["date"].to_numpy()

    # Random Forest: type and confidence
    proba = models.rf.predict_proba(X[f["all_in_order"]])
    classes = list(models.rf.classes_)
    pred = np.array(classes)[proba.argmax(axis=1)]
    confidence = proba.max(axis=1)
    misuse_score = 1 - proba[:, classes.index("normal")]

    # Isolation Forests: 3-day averaged anomaly scores
    w = m["data_isolation_forest"]["smooth_window_days"]
    data_score = _smooth(-models.data_iso.score_samples(X[f["data"]]), sim, date, w)
    call_score = _smooth(-models.call_iso.score_samples(X[f["call_sms"]]), sim, date,
                         m["call_sms_isolation_forest"]["smooth_window_days"])
    t_data = m["data_isolation_forest"]["thresholds"]
    t_call = m["call_sms_isolation_forest"]["thresholds"]

    rf_misuse = pred != "normal"
    data_unusual = data_score >= t_data["unusual"]
    data_review = data_score >= t_data["strict_review"]
    call_review = call_score >= t_call["review"]
    level = np.select([rf_misuse & data_unusual, rf_misuse, ~rf_misuse & data_review, ~rf_misuse & call_review],
                      ALERT_LEVELS, default="none")
    misuse_type = np.select([rf_misuse, level == "Review", level == "Review (calls/SMS)"],
                            [pred, "unusual data use", "unusual calling/SMS"], default="none")

    flagged_by = []
    for r, d, c in zip(rf_misuse, data_review | (rf_misuse & data_unusual), call_review):
        flagged_by.append([name for name, on in [("random_forest", r), ("data_isolation_forest", d),
                                                 ("call_sms_isolation_forest", c)] if on])

    out = pd.DataFrame({
        "sim_id": sim, "date": date, "alert_level": level, "misuse_type": misuse_type,
        "confidence": np.where(rf_misuse, confidence, np.nan), "misuse_score": misuse_score,
        "data_anomaly_score": data_score, "call_anomaly_score": call_score, "flagged_by": flagged_by,
    })
    keep = np.ones(len(out), dtype=bool)
    if score_from:
        keep &= out["date"].to_numpy() >= pd.to_datetime(score_from).strftime("%Y-%m-%d")
    if alerts_only:
        keep &= out["alert_level"].to_numpy() != "none"
    out = out[keep].copy()
    out["signals"] = [_signals(X.loc[i]) for i in out.index]
    return out.reset_index(drop=True)
