"""
Run the simulated operator once: generate usage for ProSIM's active SIMs and send it to ProSIM.

    python main.py                          # every active SIM, from the day after its last stored day up to yesterday
    python main.py --dry-run --out ./files  # write the two CSV files instead of sending them
    python main.py --demo-history 45        # SIMs with no usage yet get 45 days of history (for demonstrations)
    python main.py --force "+254712345678=sim_box" --force-days 5
                                            # make that SIM's last 5 days a sim_box episode (for demonstrations)

Settings come from the command line or from environment variables (used by the Azure scheduled job):
    PROSIM_API_URL       ProSIM API base, e.g. https://prosim-api.<env>.azurecontainerapps.io   (required)
    TIMEZONE             days are counted in this time zone (default Africa/Nairobi)
    DEMO_HISTORY_DAYS    as --demo-history (default 0: usage starts on the day the SIM was issued)
    MISUSE_RATE          multiplies the chance of a misuse episode starting (default 1.0 = as in training)
    FORCE_MISUSE         as --force, several separated by ";"
    FORCE_DAYS           as --force-days (default 5)
    MAX_DAYS             at most this many days per SIM in one run (default 90)
    BATCH_SIMS           SIMs per upload; a big backlog is sent in several imports (default 40)

Only SIMs with status Active get usage. The SIM's phone number is its sim_id, which is how ProSIM links alerts to SIM
cards and employees. The generator never sees the database: it reads the SIM list and sends files through the API,
the way an operator's CDR feed would arrive.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import Counter
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from generator import DAILY_COLUMNS, EVENT_COLUMNS, MISUSE_CATS, generate


def log(msg: str):
    print(f"{datetime.now():%H:%M:%S} {msg}", flush=True)


# ---- ProSIM API --------------------------------------------------------------------------------------------------
class Api:
    def __init__(self, base: str, timeout: int = 120):
        self.base = base.rstrip("/")
        if not self.base.endswith("/api"):
            self.base += "/api"
        self.timeout = timeout

    def _open(self, req, attempts=4, timeout=None):
        # A replica scaled to zero takes a while to start: retry connection errors and 502/503/504.
        for i in range(attempts):
            try:
                with urllib.request.urlopen(req, timeout=timeout or self.timeout) as r:
                    return r.status, r.read()
            except urllib.error.HTTPError as e:
                if e.code in (502, 503, 504) and i < attempts - 1:
                    time.sleep(10 * (i + 1))
                    continue
                return e.code, e.read()
            except (urllib.error.URLError, TimeoutError) as e:
                if i < attempts - 1:
                    log(f"  API not reachable yet ({e}); retrying")
                    time.sleep(10 * (i + 1))
                    continue
                raise

    def get(self, path: str):
        status, body = self._open(urllib.request.Request(self.base + path, headers={"Accept": "application/json"}))
        return status, (json.loads(body) if body else None)

    def post_import(self, daily_csv: bytes, events_csv: bytes, day_label: str):
        boundary = uuid.uuid4().hex
        parts = []
        for name, value in (("mode", "merge"), ("scoreAfter", "true")):
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        for name, fname, data in (("dailyFile", f"operator_daily_{day_label}.csv", daily_csv),
                                  ("eventsFile", f"operator_calls_sms_{day_label}.csv", events_csv)):
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{fname}"\r\n'
                         f"Content-Type: text/csv\r\n\r\n".encode() + data + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        req = urllib.request.Request(self.base + "/misuse/import", data=b"".join(parts), method="POST",
                                     headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
                                              "Accept": "application/json"})
        status, body = self._open(req, attempts=2, timeout=600)
        try:
            return status, json.loads(body)
        except ValueError:
            return status, {"raw": body.decode(errors="replace")[:500]}


def to_local_date(value: str | None, tz: ZoneInfo) -> date | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))   # the API stores UTC
    return dt.astimezone(tz).date()


def parse_force(specs: list[str]) -> dict[str, str]:
    out = {}
    for spec in specs:
        for item in filter(None, (s.strip() for s in spec.split(";"))):
            ref, _, cat = item.partition("=")
            cat = cat.strip()
            if cat not in MISUSE_CATS:
                sys.exit(f"--force {item!r}: category must be one of {', '.join(MISUSE_CATS)}")
            out[ref.strip()] = cat
    return out


def csv_bytes(columns, rows) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(columns)
    w.writerows(rows)
    return buf.getvalue().encode()


def main() -> int:
    env = os.environ.get
    ap = argparse.ArgumentParser(description="ProSIM simulated operator: daily CDR feed")
    ap.add_argument("--api", default=env("PROSIM_API_URL"), help="ProSIM API base URL")
    ap.add_argument("--timezone", default=env("TIMEZONE", "Africa/Nairobi"))
    ap.add_argument("--until", help="last day to generate, YYYY-MM-DD (default: yesterday)")
    ap.add_argument("--demo-history", type=int, default=int(env("DEMO_HISTORY_DAYS", "0")))
    ap.add_argument("--misuse-rate", type=float, default=float(env("MISUSE_RATE", "1.0")))
    ap.add_argument("--force", action="append", default=[env("FORCE_MISUSE")] if env("FORCE_MISUSE") else [])
    ap.add_argument("--force-days", type=int, default=int(env("FORCE_DAYS", "5")))
    ap.add_argument("--max-days", type=int, default=int(env("MAX_DAYS", "90")))
    ap.add_argument("--batch-sims", type=int, default=int(env("BATCH_SIMS", "40")))
    ap.add_argument("--dry-run", action="store_true", help="do not send; write the files to --out")
    ap.add_argument("--out", default=".", help="folder for --dry-run files")
    a = ap.parse_args()
    if not a.api:
        sys.exit("Set PROSIM_API_URL or pass --api")

    tz = ZoneInfo(a.timezone)
    until = date.fromisoformat(a.until) if a.until else datetime.now(tz).date() - timedelta(days=1)
    forced = parse_force(a.force)
    api = Api(a.api)

    status, sims = api.get("/simcards")
    if status != 200:
        log(f"Could not read the SIM list (HTTP {status}): {sims}")
        return 1
    active = [s for s in sims if s.get("status") == "Active"]
    log(f"{len(sims)} SIM cards in ProSIM, {len(active)} active; generating up to {until}")
    unknown = set(forced) - {s["phone"] for s in active}
    if unknown:
        log(f"Ignoring --force for SIM(s) that are not active: {', '.join(sorted(unknown))}")

    per_sim, truth = [], Counter()   # (daily rows, event rows) per SIM
    for s in active:
        ref = s["phone"]
        st, info = api.get("/misuse/sims/" + urllib.parse.quote(ref, safe="") + "?days=7")
        last_stored = date.fromisoformat(info["usage"][-1]["date"]) if st == 200 and info.get("usage") else None
        if last_stored:
            first = last_stored + timedelta(days=1)
        elif a.demo_history > 0:
            first = until - timedelta(days=a.demo_history - 1)
        else:
            first = to_local_date(s.get("issuedAt"), tz) or to_local_date(s.get("receivedAt"), tz) or until
        first = max(first, until - timedelta(days=a.max_days - 1))

        force_days = {}
        if ref in forced:
            f_first = until - timedelta(days=a.force_days - 1)
            force_days = {f_first + timedelta(days=i): forced[ref] for i in range(a.force_days)}
            first = min(first, f_first)   # re-send those days even if they were already sent
        if first > until:
            log(f"  {ref}: up to date")
            continue

        daily, events, t = generate(ref, first, until, a.misuse_rate, force_days)
        per_sim.append(([[d[c] for c in DAILY_COLUMNS] for d in daily], events))
        cats = Counter(c for _, c in t if c != "normal")
        truth.update(cats)
        note = ", ".join(f"{k} {v} d" for k, v in cats.items()) or "no misuse"
        log(f"  {ref}: {first}..{until} ({len(daily)} days, {len(events)} calls/SMS; {note})")

    if not per_sim:
        log("Nothing to send.")
        return 0
    log(f"{sum(len(d) for d, _ in per_sim)} SIM-days, {sum(len(e) for _, e in per_sim)} calls/SMS; "
        f"misuse days simulated: {dict(truth) or 'none'}")

    label = until.isoformat()
    size = max(1, a.batch_sims)
    chunks = [per_sim[i:i + size] for i in range(0, len(per_sim), size)]
    failed = 0
    for n, chunk in enumerate(chunks, 1):
        daily_csv = csv_bytes(DAILY_COLUMNS, [r for d, _ in chunk for r in d])
        events_csv = csv_bytes(EVENT_COLUMNS, sorted((r for _, e in chunk for r in e), key=lambda r: (r[0], r[1])))
        part = label if len(chunks) == 1 else f"{label}_part{n}of{len(chunks)}"

        if a.dry_run:
            os.makedirs(a.out, exist_ok=True)
            for name, data in ((f"operator_daily_{part}.csv", daily_csv), (f"operator_calls_sms_{part}.csv", events_csv)):
                with open(os.path.join(a.out, name), "wb") as fh:
                    fh.write(data)
            log(f"Dry run: part {n} written to {os.path.abspath(a.out)}")
            continue

        status, resp = api.post_import(daily_csv, events_csv, part)
        if status != 200:
            log(f"Import {n}/{len(chunks)} failed (HTTP {status}): {json.dumps(resp)[:800]}")
            failed += 1
            continue
        imp, sc = resp.get("import", {}), resp.get("scoring")
        log(f"Import {n}/{len(chunks)}: {imp.get('simDays')} SIM-days ({imp.get('simDaysAdded')} new), {imp.get('events')} calls/SMS, "
            f"{imp.get('sims')} SIMs, {imp.get('dateFrom')}..{imp.get('dateTo')}"
            + (f"; {sc.get('alertsSaved')} alert day(s), model {sc.get('modelVersion')}" if sc else ""))
        for w in imp.get("warnings") or []:
            log(f"  warning: {w}")
        if resp.get("scoringError"):
            log(f"  scoring: {resp['scoringError']}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
