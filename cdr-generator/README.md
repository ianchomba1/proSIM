# ProSIM CDR generator (simulated operator)

A separate service that plays the mobile operator. Once a day it reads ProSIM's SIM list through the API, generates the
previous day's usage (data sessions, calls, SMS) for every **Active** SIM, and sends it to ProSIM's CDR import
(`POST /api/misuse/import`, merge mode, scored straight away). It never connects to the database.

The behaviour model is the v4 training generator (`synthetic_cdr_generator4.ipynb`), so the data has the same
statistics the misuse models were trained on, including the seven misuse categories (`unauthorized_sharing`,
`data_reselling`, `ghost_usage`, `inactive_billing`, `call_abuse`, `sim_box`, `bulk_sms`). The SIM's phone number is
its `sim_id`, which is how ProSIM links alerts to SIM cards and employees.

Output is deterministic: a SIM's profile comes from its phone number and every day from (phone, date), so re-sending a
day produces identical data and the merge import just overwrites it.

## Run locally

```powershell
cd cdr-generator
python -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python main.py --api http://localhost:5000 --dry-run --out out   # files only
.\.venv\Scripts\python main.py --api http://localhost:5000                       # send to ProSIM
```

| Setting (flag / env var) | Default | Meaning |
|---|---|---|
| `--api` / `PROSIM_API_URL` | (required) | ProSIM API base URL |
| `--timezone` / `TIMEZONE` | `Africa/Nairobi` | days are counted in this zone |
| `--until` | yesterday | last day to generate |
| `--demo-history` / `DEMO_HISTORY_DAYS` | 0 | SIMs with no usage yet get this many days of history instead of starting on their issue date |
| `--misuse-rate` / `MISUSE_RATE` | 1.0 | multiplies the chance of a misuse episode starting |
| `--force` / `FORCE_MISUSE` | none | `"+2547XXXXXXXX=sim_box"`: make that SIM's last days an episode of that category (demonstrations) |
| `--force-days` / `FORCE_DAYS` | 5 | how many days `--force` covers |
| `--max-days` / `MAX_DAYS` | 90 | at most this many days per SIM in one run |
| `--batch-sims` / `BATCH_SIMS` | 40 | SIMs per upload; a large backlog goes in several imports |

Each run picks up where the last one stopped: for every active SIM it asks ProSIM for its latest stored day and sends
the days after it, up to yesterday. A newly issued SIM starts on its issue date.

## Notes

* ProSIM does not store job titles, so each SIM's tier (professional 55 %, manager 25 %, support 20 %) is drawn from its
  phone number. The training data's tiers came from job titles.
* Leave windows are drawn per 90-day block (training: one 90-day run), and the location / geo-velocity chain restarts
  each day instead of running across midnight.
