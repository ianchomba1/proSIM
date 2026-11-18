# proSIM ML training

Training and evaluation of the SIM misuse-detection models, run locally:

- **Isolation Forest**: unsupervised; flags SIM-days with unusual usage.
- **Random Forest**: supervised; classifies each SIM-day as `normal`,
  `unauthorized_sharing`, `data_reselling`, `ghost_usage` or `inactive_billing`.

Tracked in the **ML Training** milestone on GitHub.

## Folder layout

```
ml-training/
├── notebooks/
│   └── 01_misuse_training.ipynb   # the training notebook, one section per issue
├── data/                          # CDR CSVs (git-ignored, see below)
├── reports/                       # metrics + figures for the write-up
└── requirements.txt
```

Trained models are saved to `ml-service/models/` (git-ignored; regenerate by
running the notebook).

## Setup (once)

Training uses the ML service's Python environment, so the scikit-learn version
always matches when the service later loads the models.

```powershell
cd ml-service
.\.venv\Scripts\python -m pip install -r ..\ml-training\requirements.txt
.\.venv\Scripts\python -m ipykernel install --user --name prosim --display-name "proSIM (ml-service venv)"
```

## Data

`data/` is git-ignored. Copy these files from the CDR generator output
(`cdr_generator_results2`) into `ml-training/data/`:

| File | Contents |
|---|---|
| `synthetic_cdr_daily_agg.csv` | One row per SIM per day (1,000 SIMs x 90 days) |
| `synthetic_cdr_daily_labels.csv` | Ground-truth label per SIM-day |
| `synthetic_cdr_labels.csv` | Misuse episodes (SIM, category, start/end day) |

`synthetic_cdr_sessions.csv` (85 MB, one row per session) is not copied; it
is only needed if session-level features are added later.

## Running

Open `notebooks/01_misuse_training.ipynb` in Antigravity / VS Code, choose the
kernel **proSIM (ml-service venv)**, and run the cells top to bottom.

Note: scikit-learn trains on the CPU only (the GPU is not used). Both models
use all CPU cores via `n_jobs=-1`; at 90,000 rows training takes a few minutes.
