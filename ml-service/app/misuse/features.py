"""
Feature engineering for misuse detection: one feature row per SIM per day.

This is the same code as sections 1.1 and 3.1 of ml-training/notebooks/01_misuse_training.ipynb.
The models were trained on these exact features, so any change here must be made in the notebook too
(and the models retrained). tests/check_misuse.py checks that both give identical results.

Every feature for a day uses only that day and earlier days of the same SIM, so a day can be scored
as soon as it ends, provided the SIM's earlier days are included in the input.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Raw daily usage columns used as features (voice_minutes_remaining / sms_remaining are not used:
# they are running bundle balances that depend on the billing cycle, not on behaviour).
RAW_COLS = [
    "total_download_mb", "total_upload_mb", "total_mb", "session_count", "data_session_count",
    "total_duration_s", "max_session_mb", "hotspot_flag_count", "geo_flag_count", "roaming_sessions",
    "unique_towers", "apn_public_count", "offpeak_session_count", "offpeak_mb", "billed_mb",
    "voice_minutes_used", "sms_count",
]
# Columns compared with each SIM's own recent past
BASELINE_COLS = ["total_mb", "total_upload_mb", "session_count", "unique_towers",
                 "hotspot_flag_count", "offpeak_mb", "billed_mb"]
TIERS = ["professional", "manager", "support"]
BASELINE_WINDOW = 14  # days of history
MIN_HISTORY = 3       # days needed before a baseline is used
EPS = 1e-6

DAILY_COLUMNS = ["sim_id", "date", "tier", *RAW_COLS]
EVENT_COLUMNS = ["sim_id", "session_timestamp", "session_duration", "event_type", "call_destination"]


def build_features(data: pd.DataFrame) -> pd.DataFrame:
    """48 data and billing features per SIM-day, in the same row order as `data`."""
    d = data.copy()
    d["date"] = pd.to_datetime(d["date"])
    d = d.sort_values(["sim_id", "date"])
    out = pd.DataFrame(index=d.index)

    # 1. Raw daily usage
    for c in RAW_COLS:
        out[c] = d[c].astype(float)

    # 2. Usage-pattern ratios: HOW the line is used, independent of volume
    out["upload_share"] = d["total_upload_mb"] / (d["total_mb"] + EPS)
    out["offpeak_share"] = d["offpeak_mb"] / (d["total_mb"] + EPS)
    out["hotspot_share"] = d["hotspot_flag_count"] / (d["session_count"] + EPS)
    out["public_apn_share"] = d["apn_public_count"] / (d["data_session_count"] + EPS)
    out["mb_per_session"] = d["total_mb"] / (d["session_count"] + EPS)

    # 3. Billing vs actual usage
    out["billed_minus_used_mb"] = d["billed_mb"] - d["total_mb"]
    out["billed_to_used_ratio"] = d["billed_mb"] / (d["total_mb"] + 1.0)

    # 4. Change against the SIM's own past (shift(1): today is never part of its own baseline)
    by_sim = d.groupby("sim_id")
    for c in BASELINE_COLS:
        past = by_sim[c].shift(1)
        window = past.groupby(d["sim_id"]).rolling(BASELINE_WINDOW, min_periods=MIN_HISTORY)
        med = window.median().reset_index(level=0, drop=True)
        std = window.std().reset_index(level=0, drop=True)
        out[f"{c}_vs_baseline"] = (d[c] / (med + 1.0)).fillna(1.0)   # no history yet -> neutral 1
        out[f"{c}_z"] = ((d[c] - med) / (std + 1.0)).fillna(0.0)      # no history yet -> neutral 0
        lt_med = (past.groupby(d["sim_id"]).expanding(min_periods=MIN_HISTORY).median()
                  .reset_index(level=0, drop=True))
        out[f"{c}_vs_longterm"] = (d[c] / (lt_med + 1.0)).fillna(1.0)

    # 5. Subscriber tier, one-hot
    for t in TIERS:
        out[f"tier_{t}"] = (d["tier"] == t).astype(int)

    out = out.replace([np.inf, -np.inf], 0.0).fillna(0.0)
    return out.loc[data.index]


def prepare_call_events(raw: pd.DataFrame) -> pd.DataFrame:
    """Voice and SMS events with the date, the hour of day and the destination number without '+'."""
    s = raw[raw["event_type"].isin(["Voice", "SMS"])].copy()
    ts = pd.to_datetime(s["session_timestamp"])
    s["date"] = ts.dt.strftime("%Y-%m-%d")
    s["h"] = ts.dt.hour
    s["dest"] = s["call_destination"].fillna("").astype(str).str.lstrip("+")
    return s[["sim_id", "date", "h", "event_type", "session_duration", "dest"]].reset_index(drop=True)


def load_call_events(path) -> pd.DataFrame:
    """Read the sessions CSV written by the CDR generator."""
    raw = pd.read_csv(path, usecols=EVENT_COLUMNS, dtype={"call_destination": str})
    return prepare_call_events(raw)


def build_call_features(ev: pd.DataFrame, data: pd.DataFrame) -> pd.DataFrame:
    """20 call/SMS features per SIM-day, aligned with the rows of `data` (needs its sim_id and date columns)."""
    ev = ev.copy()
    ev["offpeak"] = ((ev["h"] >= 22) | (ev["h"] < 7)).astype(float)
    ev["intl"] = (~ev["dest"].str.startswith("254")).astype(float)
    ev["short"] = (ev["session_duration"] < 10).astype(float)
    ev["long"] = (ev["session_duration"] >= 300).astype(float)
    ev["new"] = (ev["date"] == ev.groupby(["sim_id", "dest"])["date"].transform("min")).astype(float)
    key = ["sim_id", "date"]
    v, m = ev[ev["event_type"] == "Voice"], ev[ev["event_type"] == "SMS"]
    calls = v.groupby(key).agg(
        calls=("dest", "size"), call_minutes=("session_duration", "sum"), mean_call_s=("session_duration", "mean"),
        short_call_share=("short", "mean"), long_call_share=("long", "mean"), offpeak_call_share=("offpeak", "mean"),
        intl_call_share=("intl", "mean"), new_call_share=("new", "mean"), _distinct=("dest", "nunique"))
    calls["call_minutes"] /= 60
    calls["repeat_call_share"] = 1 - calls.pop("_distinct") / calls["calls"]
    texts = m.groupby(key).agg(
        sms=("dest", "size"), offpeak_sms_share=("offpeak", "mean"), intl_sms_share=("intl", "mean"),
        new_sms_share=("new", "mean"), _distinct=("dest", "nunique"))
    texts["repeat_sms_share"] = 1 - texts.pop("_distinct") / texts["sms"]

    cf = (data[key].merge(calls.reset_index(), on=key, how="left")
          .merge(texts.reset_index(), on=key, how="left").fillna(0.0))
    cf.index = data.index
    cf = cf.sort_values(key)
    for c in ["calls", "call_minutes", "sms"]:   # change vs the SIM's own past (shift(1): today excluded)
        past = cf.groupby("sim_id")[c].shift(1)
        med14 = past.groupby(cf["sim_id"]).rolling(14, min_periods=3).median().reset_index(level=0, drop=True)
        medlt = past.groupby(cf["sim_id"]).expanding(min_periods=3).median().reset_index(level=0, drop=True)
        cf[f"{c}_vs_baseline"] = (cf[c] / (med14 + 1)).fillna(1.0)
        cf[f"{c}_vs_longterm"] = (cf[c] / (medlt + 1)).fillna(1.0)
    return cf.drop(columns=key).astype(float).loc[data.index]


def build_all_features(daily: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    """All 68 features: 48 data/billing + 20 call/SMS. `events` = output of prepare_call_events."""
    return build_features(daily).join(build_call_features(events, daily))
