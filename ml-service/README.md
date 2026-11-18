# proSIM ML service

Python FastAPI service used by the ASP.NET backend for:

- **Kenyan National ID OCR verification** during SIM registration (Tesseract)
- **SIM misuse scoring** with the three models trained in `ml-training/` (Random Forest + two Isolation Forests)

It binds to `127.0.0.1:8001`; only the backend should call it.

## Setup (once)

```powershell
winget install UB-Mannheim.TesseractOCR
cd ml-service
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

The model files are not in git. Create them by running `ml-training/notebooks/01_misuse_training.ipynb`
(section 8 writes them to `ml-service/models/`). `/health` reports whether they loaded.

## Run

```powershell
.\ml-service\run.ps1          # ML service on http://127.0.0.1:8001  (API docs: /docs)
dotnet run --project backend  # API on http://localhost:5000
npm run dev                   # frontend
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service status, and whether the misuse models are loaded |
| POST | `/ocr/kenyan-id/verify` | Multipart: `image`, `full_name`, `id_number`, `date_of_birth` -> per-field match |
| GET | `/misuse/model-info` | Model version, misuse types, thresholds, alert rules |
| POST | `/misuse/score` | Score SIM-days -> alerts with level, misuse type, confidence and plain-language signals |

The backend exposes OCR to the frontend as `POST /api/verification/national-id`, which issues a
15-minute single-use token required by `POST /api/applications`.

## Misuse scoring

`POST /misuse/score` takes JSON:

```json
{
  "daily":  [ { "sim_id": "87", "date": "2025-03-05", "tier": "professional", "total_mb": 412.5, "...": "..." } ],
  "events": [ { "sim_id": "87", "session_timestamp": "2025-03-05T14:02:11", "session_duration": 95,
                "event_type": "Voice", "call_destination": "+254712345678" } ],
  "score_from": "2025-03-01",
  "alerts_only": true
}
```

- `daily`: one row per SIM per day, with the columns of `synthetic_cdr_daily_agg.csv` (see `/docs` for the full list).
- `events`: the same SIMs' calls and SMS (data sessions may be included; they are ignored).
- **Send history, not just the new day.** Features compare each day with the SIM's own past (14-day and
  long-term baselines, "number never called before"), and the Isolation Forest scores are 3-day averages. Send
  the SIM's earlier days too (up to 90 days matches training), and set `score_from` to return only the new days.

Each result:

| Field | Meaning |
|---|---|
| `alert_level` | `High` (Random Forest + data forest agree), `Alert` (Random Forest), `Review` (unusual data use), `Review (calls/SMS)` (unusual calling/SMS) |
| `misuse_type` | Random Forest type (e.g. `data_reselling`, `sim_box`), or `unusual data use` / `unusual calling/SMS` for Review levels |
| `confidence` | Random Forest probability of that type (High/Alert only) |
| `misuse_score`, `data_anomaly_score`, `call_anomaly_score` | raw model outputs |
| `flagged_by` | which models raised it |
| `signals` | plain-language description of what is unusual that day, for the operator |

Code: `app/misuse/features.py` (same feature code as the notebook), `app/misuse/scoring.py` (models + alert
rules), `app/misuse/schemas.py` (request/response shapes).

## Checks

```powershell
.\.venv\Scripts\python tests\check_misuse.py
```

Checks that the service builds exactly the same features as the training notebook, that each threshold flags
its budgeted share of days, and that the HTTP API returns the same results and rejects bad input. Needs the data
in `ml-training/data/` and the models in `ml-service/models/`.
