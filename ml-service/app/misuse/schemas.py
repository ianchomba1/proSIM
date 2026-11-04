"""Request and response shapes for the misuse endpoints (also shown in the /docs page)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DailyUsage(BaseModel):
    """One SIM's usage on one day (same columns as synthetic_cdr_daily_agg.csv)."""
    sim_id: str | int
    date: str = Field(description="YYYY-MM-DD")
    tier: str = Field(description="professional, manager or support")
    total_download_mb: float = Field(ge=0)
    total_upload_mb: float = Field(ge=0)
    total_mb: float = Field(ge=0)
    session_count: int = Field(ge=0, description="all events that day: data sessions, calls and SMS")
    data_session_count: int = Field(ge=0)
    total_duration_s: float = Field(ge=0)
    max_session_mb: float = Field(ge=0)
    hotspot_flag_count: int = Field(ge=0)
    geo_flag_count: int = Field(ge=0)
    roaming_sessions: int = Field(ge=0)
    unique_towers: int = Field(ge=0)
    apn_public_count: int = Field(ge=0)
    offpeak_session_count: int = Field(ge=0, description="data sessions between 22:00 and 07:00")
    offpeak_mb: float = Field(ge=0)
    billed_mb: float = Field(ge=0)
    voice_minutes_used: float = Field(ge=0)
    sms_count: int = Field(ge=0)


class CallEvent(BaseModel):
    """One voice call or SMS (Data events may be sent too; they are ignored)."""
    sim_id: str | int
    session_timestamp: str = Field(description="ISO date-time, e.g. 2025-03-31T14:05:00")
    session_duration: int = Field(ge=0, description="seconds; 0 for SMS")
    event_type: Literal["Voice", "SMS", "Data"]
    call_destination: str | None = Field(default=None, description="e.g. +254712345678")


class ScoreRequest(BaseModel):
    daily: list[DailyUsage]
    events: list[CallEvent] = []
    score_from: str | None = Field(default=None, description="only return days on or after this date; earlier days are history")
    alerts_only: bool = True


class ScoredDay(BaseModel):
    sim_id: str
    date: str
    alert_level: Literal["High", "Alert", "Review", "Review (calls/SMS)", "none"]
    misuse_type: str = Field(description="Random Forest class, or 'unusual data use' / 'unusual calling/SMS' for Review levels")
    confidence: float | None = Field(description="Random Forest probability of the named misuse type (High/Alert only)")
    misuse_score: float = Field(description="Random Forest probability of any misuse")
    data_anomaly_score: float
    call_anomaly_score: float
    flagged_by: list[str]
    signals: list[str] = Field(description="plain-language description of what is unusual about the day")


class ScoreResponse(BaseModel):
    model_version: str
    sims: int
    days_scored: int
    alert_counts: dict[str, int]
    results: list[ScoredDay]


class ModelInfo(BaseModel):
    model_version: str
    created: str
    training_data: dict
    misuse_types: list[str]
    features: dict[str, int]
    thresholds: dict[str, dict[str, float]]
    smooth_window_days: int
    alert_rules: list[dict]
    history_needed_to_score_one_day: str
