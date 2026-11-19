"""
ProSIM CDR generator: the simulated mobile operator.

Produces one day of usage per active SIM in the two files ProSIM imports (POST /api/misuse/import):
  daily  : one row per SIM per day (same columns as synthetic_cdr_daily_agg.csv)
  events : calls and SMS (sim_id, session_timestamp, session_duration, event_type, call_destination)

The behaviour model follows the v4 training generator (synthetic_cdr_generator4.ipynb), so the data looks like what
the misuse models were trained on: lognormal per-SIM baseline x weekday/weekend seasonality x AR(1) noise, leave
windows, legitimate tethering and night-shift SIMs, a contact book with Zipf weights, an hourly working-day profile,
a home/work/other location plan, and a two-state Markov chain (Normal <-> Misuse) with seven misuse categories whose
severity is drawn per episode.

Unlike the notebook, which simulates 1,000 made-up employees for 90 days in one go, this runs every day against the
real SIM list, so it is DETERMINISTIC and STATELESS:
  * a SIM's profile (tier, baseline, towers, contacts...) comes from a seed derived from its phone number;
  * the day-to-day state (AR(1) noise, leave, misuse episodes) is replayed from a fixed epoch with one seeded random
    stream per (SIM, day), so day D always comes out the same whichever run produces it;
  * the sessions of a day come from a seed of (SIM, day).
Re-sending a day therefore gives identical data, and ProSIM's merge import simply overwrites it.
"""
from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

import numpy as np

EPOCH = date(2025, 1, 1)   # day-level state is replayed from here (before any SIM is issued)

# ---- Realism knobs (values from the v4 notebook) -------------------------------------------------------------------
P_ENTRY = 0.0053
LEGIT_TETHER_SIM_FRAC, LEGIT_TETHER_DAY_PROB, RANDOM_TETHER_DAY_PROB = 0.12, 0.12, 0.01
TETHER_VOL_MULT, TETHER_SESSION_FRAC = (1.2, 2.0), (0.15, 0.50)
NIGHT_SHIFT_SIM_FRAC, P_OFFPEAK_NIGHT_SHIFT = 0.10, 0.35
LEAVE_BLOCK_DAYS = 90                      # notebook: 20% of SIMs get one leave window per 90-day run
LEAVE_SIM_FRAC, LEAVE_LEN_DAYS = 0.20, (3, 14)
LEAVE_USAGE_MULT, LEAVE_ACTIVITY_MULT, LEAVE_PHONE_OFF_PROB = (0.02, 0.20), 0.30, 0.25

SHARING_VOL_MULT, SHARING_HOTSPOT_FRAC, SHARING_HOTSPOT_MISS = (1.4, 3.5), (0.25, 0.90), 0.15
RESELL_BURST_PROB, RESELL_BURST_MB, RESELL_OFFPEAK_FRAC = (0.15, 0.45), (500, 3_000), (0.30, 0.70)
GHOST_LEVEL_MEDIAN_MB, GHOST_LEVEL_SIGMA, GHOST_LEVEL_CLIP = 12.0, 0.8, (2.0, 120.0)
GHOST_OFFPEAK_FRAC, GHOST_ACTIVITY_MULT = (0.40, 0.80), 0.30
INACTIVE_ACTIVITY_MULT, INACTIVE_TRICKLE_PROB = 0.10, 0.30

GEO_PROB_BASE, GEO_PROB_SHARING, GEO_IMPOSSIBLE_KMH, VEL_FLAG_KMH = 0.005, 0.04, (1_000, 5_000), 900.0
ROAM_PROB_BASE, ROAM_PROB_RESELL = 0.005, 0.03

CONTACTS_PER_SIM, CONTACT_ZIPF_A, P_NEW_NUMBER = (10, 40), 1.3, 0.12
CALL_RATE_CV, HEAVY_CALLER_SIM_FRAC, HEAVY_CALLER_MULT = 0.50, 0.05, (2.0, 4.0)
VOICE_WEEKEND_MULT, VOICE_AR1_PHI, VOICE_AR1_SIGMA = 0.6, 0.35, 0.25
INTL_CALLER_SIM_FRAC = {"manager": 0.25, "professional": 0.08, "support": 0.03}
INTL_CONTACTS, P_INTL_CALL = (1, 3), 0.08
INTL_PREFIXES_LEGIT = ["+1", "+44", "+971", "+86", "+27", "+256", "+255"]

CALL_ABUSE_PREMIUM_P, CALL_ABUSE_EXTRA_CALLS, CALL_ABUSE_DUR_S, CALL_ABUSE_EVENING_P = 0.5, (2, 10), (240, 1500), 0.7
PREMIUM_PREFIXES = ["+882", "+881", "+216", "+252", "+371"]
SIM_BOX_CALLS, SIM_BOX_DUR_S, SIM_BOX_DATA_MULT, SIM_BOX_OWNER_ACTIVITY = (15, 150), (30, 240), (0.05, 0.40), 0.10
BULK_SMS_PER_DAY = (10, 200)

AR1_PHI, AR1_SIGMA_ETA = 0.40, 0.15
AVG_SESSIONS_PER_DAY, WEEKEND_SESSION_MULT = 5, 0.15
MEAN_CALL_DURATION_S = 102.9

HOURLY_WEEKDAY = np.array([
    0.005, 0.003, 0.002, 0.002, 0.003, 0.010, 0.025,
    0.060, 0.120, 0.130, 0.110, 0.080,
    0.045, 0.085, 0.110, 0.090, 0.050,
    0.030, 0.015, 0.010, 0.008, 0.007, 0.005, 0.005])
HOURLY_WEEKEND = np.array([
    0.010, 0.006, 0.004, 0.003, 0.003, 0.005, 0.012,
    0.025, 0.045, 0.065, 0.080, 0.085,
    0.085, 0.080, 0.075, 0.075, 0.072,
    0.068, 0.062, 0.050, 0.035, 0.025, 0.018, 0.012])
HOURLY_WEEKDAY = HOURLY_WEEKDAY / HOURLY_WEEKDAY.sum()
HOURLY_WEEKEND = HOURLY_WEEKEND / HOURLY_WEEKEND.sum()
_NIGHT = np.r_[0:7, 22:24]
NIGHT_SHARE_WEEKDAY = float(HOURLY_WEEKDAY[_NIGHT].sum())
NIGHT_SHARE_WEEKEND = float(HOURLY_WEEKEND[_NIGHT].sum())

WORKDAY_KIND_P = [0.85, 0.10, 0.05]
LEAVE_HOME_H, LEAVE_WORK_H, COMMUTE_H = (6.5, 8.0), (16.5, 18.0), (0.5, 1.25)
WEEKEND_OUTING_P, OUTING_START_H, OUTING_LEN_H = 0.60, (9.0, 17.0), (1.5, 5.0)

TOWER_POOL = [
    (-1.2921, 36.8219), (-1.3031, 36.7073), (-1.2195, 36.8870), (-1.3667, 36.7667), (-1.2639, 36.8010),
    (-1.2400, 36.9000), (-1.3172, 36.8272), (-1.2833, 36.8167), (-1.1765, 36.9640), (-1.3741, 36.6544),
]

# Tiers the models know. ProSIM does not store job titles, so a SIM's tier is drawn from its seed with these shares.
TIER_SHARES = {"professional": 0.55, "manager": 0.25, "support": 0.20}
TIER_PARAMS = {
    "manager":      {"bundle_gb": 60, "mean_mb": 750, "cv": 0.40, "calls": 3.92, "sms": 3.06},
    "professional": {"bundle_gb": 40, "mean_mb": 500, "cv": 0.45, "calls": 2.61, "sms": 2.04},
    "support":      {"bundle_gb": 20, "mean_mb": 250, "cv": 0.35, "calls": 1.31, "sms": 1.02},
}

DATA_CATS = ["unauthorized_sharing", "data_reselling", "ghost_usage", "inactive_billing"]
CALL_CATS = ["call_abuse", "sim_box", "bulk_sms"]
MISUSE_CATS = DATA_CATS + CALL_CATS
CATEGORY_WEIGHTS = np.array([0.266, 0.19, 0.19, 0.114, 0.10, 0.07, 0.07])
CATEGORY_Q = {"unauthorized_sharing": 1 / 14, "data_reselling": 1 / 10, "ghost_usage": 1 / 20,
              "inactive_billing": 1 / 18, "call_abuse": 1 / 10, "sim_box": 1 / 14, "bulk_sms": 1 / 7}

DAILY_COLUMNS = ["sim_id", "date", "tier", "total_download_mb", "total_upload_mb", "total_mb", "session_count",
                 "data_session_count", "total_duration_s", "max_session_mb", "hotspot_flag_count", "geo_flag_count",
                 "roaming_sessions", "unique_towers", "apn_public_count", "offpeak_session_count", "offpeak_mb",
                 "billed_mb", "voice_minutes_used", "sms_count"]
EVENT_COLUMNS = ["sim_id", "session_timestamp", "session_duration", "event_type", "call_destination"]

_DIGITS = np.array(list("0123456789"))


def _seed(*parts) -> int:
    h = hashlib.sha256("|".join(str(p) for p in parts).encode()).digest()
    return int.from_bytes(h[:8], "little")


def _rng(*parts) -> np.random.Generator:
    return np.random.default_rng(_seed(*parts))


def _lognorm_params(mean: float, cv: float):
    s2 = math.log(1 + cv ** 2)
    return math.log(mean) - s2 / 2, math.sqrt(s2)


def _log_uniform(lo, hi, rng):
    return float(math.exp(rng.uniform(math.log(lo), math.log(hi))))


def _local_number(rng):
    return "+2547" + "".join(rng.choice(_DIGITS, 8))


def _foreign_number(prefixes, rng):
    return str(rng.choice(prefixes)) + "".join(rng.choice(_DIGITS, 9))


# ---- Per-SIM profile ---------------------------------------------------------------------------------------------
@dataclass
class Profile:
    sim_ref: str
    tier: str
    baseline_mb: float
    bundle_gb: float
    tetherer: bool
    night_shift: bool
    towers: list            # 3 (lat, lon) tuples: home, work, other
    tower_ids: list         # their NBI-xxx ids
    call_mult: float
    contacts: list
    contact_w: np.ndarray
    intl_contacts: list


def make_profile(sim_ref: str) -> Profile:
    rng = _rng("profile", sim_ref)
    tier = str(rng.choice(list(TIER_SHARES), p=list(TIER_SHARES.values())))
    p = TIER_PARAMS[tier]
    mu, sigma = _lognorm_params(p["mean_mb"], p["cv"])
    idx = rng.choice(len(TOWER_POOL), size=3, replace=False)
    cv2 = math.log(1 + CALL_RATE_CV ** 2)
    call_mult = float(rng.lognormal(-cv2 / 2, math.sqrt(cv2)))
    if rng.random() < HEAVY_CALLER_SIM_FRAC:
        call_mult *= float(rng.uniform(*HEAVY_CALLER_MULT))
    n = int(rng.integers(CONTACTS_PER_SIM[0], CONTACTS_PER_SIM[1] + 1))
    w = 1.0 / np.arange(1, n + 1) ** CONTACT_ZIPF_A
    intl = ([_foreign_number(INTL_PREFIXES_LEGIT, rng) for _ in range(int(rng.integers(INTL_CONTACTS[0], INTL_CONTACTS[1] + 1)))]
            if rng.random() < INTL_CALLER_SIM_FRAC[tier] else [])
    return Profile(
        sim_ref=sim_ref, tier=tier, baseline_mb=float(rng.lognormal(mu, sigma)), bundle_gb=p["bundle_gb"],
        tetherer=bool(rng.random() < LEGIT_TETHER_SIM_FRAC), night_shift=bool(rng.random() < NIGHT_SHIFT_SIM_FRAC),
        towers=[TOWER_POOL[i] for i in idx], tower_ids=[f"NBI-{i:03d}" for i in idx], call_mult=call_mult,
        contacts=[_local_number(rng) for _ in range(n)], contact_w=w / w.sum(), intl_contacts=intl)


# ---- Day-level state (replayed from EPOCH) -----------------------------------------------------------------------
@dataclass
class DayState:
    day: date
    weekend: bool
    usage_mb: float
    billed_mb: float
    category: str           # "normal" or a misuse category
    params: dict
    hotspot_p: float
    offpeak_p: float
    geo_p: float
    roam_p: float
    activity: float         # voice/SMS multiplier
    voice_ar: float         # voice AR(1) multiplier (mean 1)
    off_day: bool           # leave or weekend: no commute


def _leave_window(sim_ref: str, block: int):
    """At most one leave window per 90-day block: (start_day_index, end_day_index, phone_off, usage_mult) or None."""
    rng = _rng("leave", sim_ref, block)
    if rng.random() >= LEAVE_SIM_FRAC:
        return None
    length = int(rng.integers(LEAVE_LEN_DAYS[0], LEAVE_LEN_DAYS[1] + 1))
    start = block * LEAVE_BLOCK_DAYS + int(rng.integers(0, LEAVE_BLOCK_DAYS - length + 1))
    return start, start + length - 1, bool(rng.random() < LEAVE_PHONE_OFF_PROB), float(rng.uniform(*LEAVE_USAGE_MULT))


def _episode_params(category: str, rng) -> dict:
    if category == "unauthorized_sharing":
        return {"mult": rng.uniform(*SHARING_VOL_MULT), "hot_frac": rng.uniform(*SHARING_HOTSPOT_FRAC)}
    if category == "data_reselling":
        return {"burst_p": rng.uniform(*RESELL_BURST_PROB), "off_frac": rng.uniform(*RESELL_OFFPEAK_FRAC)}
    if category == "ghost_usage":
        return {"level": float(np.clip(rng.lognormal(math.log(GHOST_LEVEL_MEDIAN_MB), GHOST_LEVEL_SIGMA), *GHOST_LEVEL_CLIP)),
                "off_frac": rng.uniform(*GHOST_OFFPEAK_FRAC)}
    if category == "call_abuse":
        style = "premium" if rng.random() < CALL_ABUSE_PREMIUM_P else "personal"
        prm = {"style": style, "extra_calls": _log_uniform(*CALL_ABUSE_EXTRA_CALLS, rng),
               "mean_dur_s": float(rng.uniform(*CALL_ABUSE_DUR_S))}
        if style == "premium":
            prm["numbers"] = [_foreign_number(PREMIUM_PREFIXES, rng) for _ in range(int(rng.integers(2, 4)))]
        return prm
    if category == "sim_box":
        return {"calls": _log_uniform(*SIM_BOX_CALLS, rng), "data_mult": float(rng.uniform(*SIM_BOX_DATA_MULT))}
    if category == "bulk_sms":
        return {"sms": _log_uniform(*BULK_SMS_PER_DAY, rng)}
    return {}


def day_states(prof: Profile, first: date, last: date, misuse_rate: float = 1.0,
               forced: dict | None = None) -> list[DayState]:
    """States for first..last. The chain is replayed from EPOCH so a day always gets the same state.
    forced: {date: category} puts those days into a misuse episode of that category (for demonstrations)."""
    forced = forced or {}
    p_entry = min(1.0, P_ENTRY * misuse_rate)
    eps = 0.0
    veps = 0.0
    v_var = VOICE_AR1_SIGMA ** 2 / (1 - VOICE_AR1_PHI ** 2)
    state, params = "normal", {}
    forced_params: dict = {}
    leave_cache: dict = {}
    out = []
    d = EPOCH
    while d <= last:
        i = (d - EPOCH).days
        rng = _rng("day", prof.sim_ref, d.isoformat())
        eps = AR1_PHI * eps + rng.normal(0, AR1_SIGMA_ETA)
        veps = VOICE_AR1_PHI * veps + rng.normal(0, VOICE_AR1_SIGMA)
        weekend = d.weekday() >= 5
        vol = prof.baseline_mb * (0.5 if weekend else 1.0) * math.exp(eps)

        block = i // LEAVE_BLOCK_DAYS
        if block not in leave_cache:
            leave_cache[block] = _leave_window(prof.sim_ref, block)
        lw = leave_cache[block]
        on_leave = lw is not None and lw[0] <= i <= lw[1]
        phone_off = on_leave and lw[2]
        activity = 1.0
        if on_leave:
            if phone_off:
                vol = float(rng.uniform(0.1, 2.0)) if rng.random() < INACTIVE_TRICKLE_PROB else 0.0
                activity = INACTIVE_ACTIVITY_MULT
            else:
                vol *= lw[3]
                activity = LEAVE_ACTIVITY_MULT

        hotspot_p = 0.0
        p_tether = LEGIT_TETHER_DAY_PROB if prof.tetherer else RANDOM_TETHER_DAY_PROB
        tether_draw, tether_frac, tether_mult = rng.random(), rng.uniform(*TETHER_SESSION_FRAC), rng.uniform(*TETHER_VOL_MULT)
        if not on_leave and tether_draw < p_tether:
            vol *= tether_mult
            hotspot_p = tether_frac

        # Markov chain: entry takes effect today; exit is decided after today (today was the last misuse day)
        entry_draw, cat_draw, exit_draw = rng.random(), rng.random(), rng.random()
        if state == "normal" and entry_draw < p_entry:
            state = MISUSE_CATS[int(np.searchsorted(np.cumsum(CATEGORY_WEIGHTS), cat_draw * CATEGORY_WEIGHTS.sum()))]
            params = _episode_params(state, _rng("episode", prof.sim_ref, d.isoformat()))
        category = state
        prm = params
        if d in forced:                         # demonstration: override, keep the chain itself untouched
            category = forced[d]
            if category not in forced_params:
                forced_params[category] = _episode_params(category, _rng("forced", prof.sim_ref, category))
            prm = forced_params[category]

        offpeak_p = P_OFFPEAK_NIGHT_SHIFT if prof.night_shift else 0.0
        geo_p, roam_p = GEO_PROB_BASE, ROAM_PROB_BASE
        usage, billed = vol, vol
        if category != "normal":
            mrng = _rng("misuse-day", prof.sim_ref, d.isoformat())
            if category == "unauthorized_sharing":
                usage = vol * prm["mult"]
                hotspot_p = 0.0 if mrng.random() < SHARING_HOTSPOT_MISS else prm["hot_frac"]
                geo_p = GEO_PROB_SHARING
            elif category == "data_reselling":
                usage = vol + (mrng.uniform(*RESELL_BURST_MB) if mrng.random() < prm["burst_p"] else 0.0)
                offpeak_p, roam_p = prm["off_frac"], ROAM_PROB_RESELL
            elif category == "ghost_usage":
                usage = prm["level"] * mrng.lognormal(0.0, 0.3)
                offpeak_p, activity = prm["off_frac"], GHOST_ACTIVITY_MULT
            elif category == "inactive_billing":
                usage = mrng.uniform(0.1, 2.0) if mrng.random() < INACTIVE_TRICKLE_PROB else 0.0
                billed = prof.bundle_gb * 1_000 * 0.9 * CATEGORY_Q[category]
                activity = INACTIVE_ACTIVITY_MULT
            elif category == "sim_box":
                usage = vol * prm["data_mult"]
                activity = SIM_BOX_OWNER_ACTIVITY
            billed = usage if category != "inactive_billing" else billed

        if d >= first:
            out.append(DayState(day=d, weekend=weekend, usage_mb=float(usage), billed_mb=float(billed),
                                category=category, params=prm, hotspot_p=float(hotspot_p), offpeak_p=float(offpeak_p),
                                geo_p=geo_p, roam_p=roam_p, activity=activity,
                                voice_ar=math.exp(veps - v_var / 2), off_day=weekend or on_leave))
        if state != "normal" and exit_draw < CATEGORY_Q[state]:
            state, params = "normal", {}
        d += timedelta(days=1)
    return out


# ---- Sessions of one day -----------------------------------------------------------------------------------------
def _draw_hours(n, p_off, weekend, rng):
    prof, base = (HOURLY_WEEKEND, NIGHT_SHARE_WEEKEND) if weekend else (HOURLY_WEEKDAY, NIGHT_SHARE_WEEKDAY)
    hours = rng.choice(24, size=n, p=prof) + rng.random(n)
    extra = max(0.0, (p_off - base) / (1.0 - base))
    night = rng.random(n) < extra
    if night.any():
        hours[night] = rng.uniform(22, 31, int(night.sum())) % 24
    return hours


def _draw_hours_flat(n, p_off, rng):
    h = rng.uniform(7, 22, n)
    off = rng.random(n) < p_off
    if off.any():
        h[off] = rng.uniform(22, 31, int(off.sum())) % 24
    return h


def _day_plan(free_day, rng):
    if free_day:
        if rng.random() < WEEKEND_OUTING_P:
            s = float(rng.uniform(*OUTING_START_H))
            e = min(23.5, s + float(rng.uniform(*OUTING_LEN_H)))
            return [(0.0, s, 0), (s, e, 2), (e, 24.0, 0)]
        return [(0.0, 24.0, 0)]
    kind = int(rng.choice(3, p=WORKDAY_KIND_P))
    if kind == 1:
        return [(0.0, 24.0, 0)]
    leave = float(rng.uniform(*LEAVE_HOME_H))
    arrive = leave + float(rng.uniform(*COMMUTE_H))
    go = float(rng.uniform(*LEAVE_WORK_H))
    back = go + float(rng.uniform(*COMMUTE_H))
    site = 1 if kind == 0 else 2
    return [(0.0, leave, 0), (leave, arrive, 2), (arrive, go, site), (go, back, 2), (back, 24.0, 0)]


def _tower_at(plan, hour):
    h = hour % 24
    for s, e, t in plan:
        if s <= h < e:
            return t
    return 0


def _haversine_km(a, b):
    (lat1, lon1), (lat2, lon2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    x = math.sin(math.radians(lat2 - lat1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6_371.0 * 2 * math.asin(math.sqrt(x))


def _normal_dest(prof: Profile, rng):
    if prof.intl_contacts and rng.random() < P_INTL_CALL:
        return str(rng.choice(prof.intl_contacts))
    if rng.random() < P_NEW_NUMBER:
        return _local_number(rng)
    return prof.contacts[int(rng.choice(len(prof.contacts), p=prof.contact_w))]


@dataclass
class DayOutput:
    daily: dict
    events: list = field(default_factory=list)   # (timestamp str, duration s, "Voice"/"SMS", destination)


def generate_day(prof: Profile, st: DayState) -> DayOutput:
    rng = _rng("sessions", prof.sim_ref, st.day.isoformat())
    plan = _day_plan(st.off_day, rng)
    midnight = datetime.combine(st.day, datetime.min.time())

    # Data sessions
    lam = AVG_SESSIONS_PER_DAY * (WEEKEND_SESSION_MULT if st.weekend else 1.0)
    n = max(1, int(rng.poisson(lam)))
    vols = np.array([st.usage_mb]) if n == 1 else st.usage_mb * rng.dirichlet(np.ones(n))
    secs = np.sort((_draw_hours(n, st.offpeak_p, st.weekend, rng) * 3600).astype(np.int64))
    anom = rng.random(n) < st.geo_p
    anom[0] = False
    prev_t, prev_s = None, None
    dl = ul = dur = mx = off_mb = 0.0
    hot = geo = roam = apn_pub = off_n = 0
    towers_used = set()
    for k in range(n):
        if anom[k]:
            cur = int(rng.choice([t for t in range(3) if t != prev_t]))
            gap = max(1, int(_haversine_km(prof.towers[prev_t], prof.towers[cur]) / rng.uniform(*GEO_IMPOSSIBLE_KMH) * 3600))
            secs[k] = min(secs[k], secs[k - 1] + gap)
        else:
            cur = _tower_at(plan, secs[k] / 3600.0)
        if prev_s is not None and prev_t != cur:
            kmh = _haversine_km(prof.towers[prev_t], prof.towers[cur]) / (max(1, secs[k] - prev_s) / 3600.0)
            geo += int(kmh > VEL_FLAG_KMH)
        frac = float(rng.beta(7, 3))
        v = float(vols[k])
        d_mb, u_mb = round(v * frac, 4), round(v * (1 - frac), 4)
        dl += d_mb
        ul += u_mb
        mx = max(mx, d_mb + u_mb)
        apn_pub += int(rng.random() < 0.08)
        hot += int(rng.random() < st.hotspot_p)
        dur += max(10, int(rng.lognormal(math.log(300), 0.5)))
        roam += int(rng.random() < st.roam_p)
        h = secs[k] / 3600.0
        if h >= 22 or h < 7:
            off_n += 1
            off_mb += d_mb + u_mb
        towers_used.add(cur)
        prev_t, prev_s = cur, secs[k]

    # Calls and SMS
    events = []

    def emit(etype, hours, durations, dests):
        nonlocal roam, dur
        for h, d_s, dest in zip(hours, durations, dests):
            towers_used.add(_tower_at(plan, float(h)))
            roam += int(rng.random() < st.roam_p)
            dur += int(d_s)
            ts = midnight + timedelta(seconds=int(float(h) * 3600) % 86_400)
            events.append((ts.strftime("%Y-%m-%d %H:%M:%S"), int(d_s), etype, dest))

    tp = TIER_PARAMS[prof.tier]
    mult = prof.call_mult * (VOICE_WEEKEND_MULT if st.weekend else 1.0) * st.voice_ar * st.activity
    p_off = P_OFFPEAK_NIGHT_SHIFT if prof.night_shift else 0.0
    nc = int(rng.poisson(tp["calls"] * mult))
    if nc:
        emit("Voice", _draw_hours(nc, p_off, st.weekend, rng),
             np.maximum(1, rng.exponential(MEAN_CALL_DURATION_S, nc)).astype(int),
             [_normal_dest(prof, rng) for _ in range(nc)])
    ns = int(rng.poisson(tp["sms"] * mult))
    if ns:
        emit("SMS", _draw_hours(ns, p_off, st.weekend, rng), np.zeros(ns, int), [_normal_dest(prof, rng) for _ in range(ns)])

    prm = st.params
    if st.category == "call_abuse":
        k = max(1, int(rng.poisson(prm["extra_calls"])))
        if prm["style"] == "personal":
            targets = prof.contacts[:2]
            hrs = np.where(rng.random(k) < CALL_ABUSE_EVENING_P, rng.uniform(18, 24, k), rng.uniform(7, 18, k))
        else:
            targets = prm["numbers"]
            hrs = rng.uniform(7, 22, k)
        emit("Voice", hrs, np.maximum(30, rng.exponential(prm["mean_dur_s"], k)).astype(int),
             [str(rng.choice(targets)) for _ in range(k)])
    elif st.category == "sim_box":
        k = max(1, int(rng.poisson(prm["calls"])))
        emit("Voice", _draw_hours_flat(k, 0.15, rng), rng.integers(SIM_BOX_DUR_S[0], SIM_BOX_DUR_S[1] + 1, k),
             [_local_number(rng) for _ in range(k)])
    elif st.category == "bulk_sms":
        k = max(1, int(rng.poisson(prm["sms"])))
        emit("SMS", rng.uniform(8, 20, k), np.zeros(k, int), [_local_number(rng) for _ in range(k)])

    voice_s = sum(e[1] for e in events if e[2] == "Voice")
    sms = sum(1 for e in events if e[2] == "SMS")
    daily = {
        "sim_id": prof.sim_ref, "date": st.day.isoformat(), "tier": prof.tier,
        "total_download_mb": round(dl, 4), "total_upload_mb": round(ul, 4), "total_mb": round(dl + ul, 4),
        "session_count": n + len(events), "data_session_count": n, "total_duration_s": int(dur),
        "max_session_mb": round(mx, 4), "hotspot_flag_count": hot, "geo_flag_count": geo, "roaming_sessions": roam,
        "unique_towers": len(towers_used), "apn_public_count": apn_pub, "offpeak_session_count": off_n,
        "offpeak_mb": round(off_mb, 4), "billed_mb": round(st.billed_mb, 3),
        "voice_minutes_used": round(voice_s / 60.0, 3), "sms_count": sms,
    }
    return DayOutput(daily=daily, events=sorted(events))


def generate(sim_ref: str, first: date, last: date, misuse_rate: float = 1.0, forced: dict | None = None):
    """All days first..last for one SIM: (list of daily dicts, list of event rows, list of (date, category))."""
    prof = make_profile(sim_ref)
    daily, events, truth = [], [], []
    for st in day_states(prof, first, last, misuse_rate, forced):
        out = generate_day(prof, st)
        daily.append(out.daily)
        events.extend((sim_ref, ts, d, t, dest) for ts, d, t, dest in out.events)
        truth.append((st.day, st.category))
    return daily, events, truth
