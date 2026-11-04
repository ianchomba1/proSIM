"""
Checks for the misuse scoring. Run from ml-service/:
    .venv\\Scripts\\python tests\\check_misuse.py

1. The service's feature code gives exactly the same features as the training notebook.
2. Scoring all training data with the saved models flags exactly the budgeted share of days.
3. The HTTP API (started on a spare port) returns the same results for a few SIMs as scoring them in-process,
   and rejects bad input.
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import nbformat
import numpy as np
import pandas as pd

SERVICE = Path(__file__).resolve().parents[1]
ROOT = SERVICE.parent
DATA = ROOT / "ml-training" / "data"
NOTEBOOK = ROOT / "ml-training" / "notebooks" / "01_misuse_training.ipynb"
sys.path.insert(0, str(SERVICE))

from app.misuse import features as F  # noqa: E402
from app.misuse import scoring  # noqa: E402

t0 = time.time()
daily = pd.read_csv(DATA / "synthetic_cdr_daily_agg.csv")
labels = pd.read_csv(DATA / "synthetic_cdr_daily_labels.csv")
raw_events = pd.read_csv(DATA / "synthetic_cdr_sessions.csv", usecols=F.EVENT_COLUMNS, dtype={"call_destination": str})
df = daily.merge(labels, on=["sim_id", "date"], validate="one_to_one").sort_values(["sim_id", "date"]).reset_index(drop=True)
print(f"Loaded {len(df):,} SIM-days and {len(raw_events):,} events in {time.time() - t0:.0f}s")

# ---------------------------------------------------------------- 1. same features as the notebook
nb = nbformat.read(NOTEBOOK, 4)
ns = {"pd": pd, "np": np}
call_src = next(c.source for c in nb.cells if c.cell_type == "code" and "def build_call_features" in c.source)
exec(call_src.split("\nEV = load_call_events")[0].replace('SESSIONS_FILE = DATA_DIR / "synthetic_cdr_sessions.csv"', ""), ns)
data_src = next(c.source for c in nb.cells if c.cell_type == "code" and "def build_features" in c.source)
exec(data_src.split("\nX = build_features(df)")[0], ns)

ev = F.prepare_call_events(raw_events)
nb_ev = ns["load_call_events"](DATA / "synthetic_cdr_sessions.csv")
assert ev.equals(nb_ev), "call events prepared differently"
X_service = F.build_all_features(df, ev)
X_notebook = ns["build_features"](df).join(ns["build_call_features"](nb_ev, df))
assert list(X_service.columns) == list(X_notebook.columns)
diff = (X_service - X_notebook).abs().to_numpy().max()
assert diff == 0, diff
meta = scoring.load_models().meta
assert list(X_service.columns) == meta["features"]["all_in_order"], "feature order differs from the saved model"
print(f"1. OK  service features identical to the notebook ({X_service.shape[1]} features, largest difference {diff})")

# ---------------------------------------------------------------- 2. full-data scoring
t0 = time.time()
res = scoring.score(df.drop(columns="label"), raw_events, alerts_only=False)
print(f"   scored {len(res):,} SIM-days in {time.time() - t0:.0f}s")
m = meta["models"]
shares = {
    "data IF unusual": ((res.data_anomaly_score >= m["data_isolation_forest"]["thresholds"]["unusual"]).mean(),
                        m["data_isolation_forest"]["budgets"]["unusual"]),
    "data IF strict": ((res.data_anomaly_score >= m["data_isolation_forest"]["thresholds"]["strict_review"]).mean(),
                       m["data_isolation_forest"]["budgets"]["strict_review"]),
    "call/SMS IF": ((res.call_anomaly_score >= m["call_sms_isolation_forest"]["thresholds"]["review"]).mean(),
                    m["call_sms_isolation_forest"]["budgets"]["review"]),
}
for name, (got, want) in shares.items():
    assert abs(got - want) < 1e-4, (name, got, want)
print("2. OK  each threshold flags exactly its budget: " + ", ".join(f"{k} {v[0]:.2%}" for k, v in shares.items()))
res["label"] = df["label"].to_numpy()
table = res.groupby("alert_level").agg(days=("label", "size"), real_misuse=("label", lambda s: (s != "normal").mean()))
print("   alert levels on the training data (optimistic: the models were trained on these days):")
print(table.reindex(scoring.ALERT_LEVELS + ["none"]).round(3).to_string())

# ---------------------------------------------------------------- 3. HTTP API
eps = pd.read_csv(DATA / "synthetic_cdr_labels.csv")
recent = eps[eps.start_day >= 62]   # episodes that start after 2025-03-03, i.e. inside the scored window
sims = [int(recent[recent.category == c].sim_id.iloc[0]) for c in ["sim_box", "call_abuse", "data_reselling"]]
sims.append(int(df[~df.sim_id.isin(eps.sim_id)].sim_id.iloc[0]))   # a SIM that never misused
score_from = "2025-03-01"

sub_daily = df[df.sim_id.isin(sims)].drop(columns="label")
sub_ev = raw_events[raw_events.sim_id.isin(sims) & raw_events.event_type.isin(["Voice", "SMS"])]
payload = {
    "daily": json.loads(sub_daily.to_json(orient="records")),
    "events": json.loads(sub_ev.assign(session_timestamp=sub_ev.session_timestamp.astype(str)).to_json(orient="records")),
    "score_from": score_from, "alerts_only": True,
}
PORT = 8011
server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
                          cwd=SERVICE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def call(method, path, body=None):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}", method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


try:
    for _ in range(60):
        try:
            status, health = call("GET", "/health")
            break
        except OSError:
            time.sleep(1)
    assert health["misuse_models"] == "ready", health
    status, info = call("GET", "/misuse/model-info")
    assert status == 200 and info["model_version"] == meta["model_version"], info

    t0 = time.time()
    status, out = call("POST", "/misuse/score", payload)
    assert status == 200, out
    print(f"3. OK  /misuse/score: {len(sims)} SIMs, {out['days_scored']} days scored, "
          f"{len(out['results'])} alerts in {time.time() - t0:.1f}s")

    # Same results as scoring those SIM-days within the full data (a SIM's features use only its own rows)
    want = res[res.sim_id.isin(sims) & (res.date >= score_from) & (res.alert_level != "none")]
    got = pd.DataFrame(out["results"]).sort_values(["sim_id", "date"]).reset_index(drop=True)
    want = want.assign(sim_id=want.sim_id.astype(str)).sort_values(["sim_id", "date"]).reset_index(drop=True)
    assert len(got) == len(want), (len(got), len(want))
    assert (got.alert_level.to_numpy() == want.alert_level.to_numpy()).all()
    assert np.allclose(got.misuse_score, want.misuse_score.round(4))
    print("   OK  API results identical to scoring the same SIMs inside the full data")
    for sim in sims:
        mine = got[got.sim_id == str(sim)]
        truth = df[(df.sim_id == sim) & (df.date >= score_from)].label
        print(f"   SIM {sim}: true misuse days since {score_from}: {int((truth != 'normal').sum())} "
              f"({', '.join(sorted(set(truth) - {'normal'})) or 'none'}); alerts: "
              f"{mine.alert_level.value_counts().to_dict() or 'none'}")
    example = got.iloc[0].to_dict()
    print("   example alert:", json.dumps(example, indent=2)[:900])

    # Bad input is rejected with a clear message
    bad = dict(payload, events=payload["events"] + [dict(payload["events"][0], sim_id=999999)])
    status, err = call("POST", "/misuse/score", bad)
    assert status == 422 and "no daily rows" in err["detail"], (status, err)
    bad = dict(payload, daily=[{k: v for k, v in r.items() if k != "billed_mb"} for r in payload["daily"]])
    status, err = call("POST", "/misuse/score", bad)
    assert status == 422, (status, err)
    print("   OK  bad input rejected (unknown SIM in events; missing column)")
finally:
    server.terminate()
print("All checks passed")
