"""
proSIM ML service: Kenyan ID OCR verification and SIM misuse scoring.

Run (from ml-service/):
    .venv\\Scripts\\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
Only the ASP.NET backend should call this service; it binds to localhost.
"""
import math
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .misuse import scoring
from .misuse.features import EVENT_COLUMNS
from .misuse.schemas import ModelInfo, ScoreRequest, ScoreResponse
from .ocr import verify_kenyan_id

MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DAILY_ROWS = 200_000
MAX_EVENTS = 2_000_000


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:  # load the models now so the first scoring request is fast; /health reports a failure
        scoring.load_models()
    except scoring.ModelsNotAvailable:
        pass
    yield


app = FastAPI(title="proSIM ML service", version="1.1.0", lifespan=lifespan)


@app.get("/health")
def health():
    try:
        scoring.load_models()
        misuse = "ready"
    except scoring.ModelsNotAvailable as exc:
        misuse = f"unavailable: {exc}"
    return {"status": "ok", "misuse_models": misuse}


@app.post("/ocr/kenyan-id/verify")
async def verify_id(
    image: UploadFile = File(...),
    full_name: str = Form(...),
    id_number: str = Form(...),
    date_of_birth: str = Form(...),
):
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Upload a JPG, PNG or WEBP photo of the ID.")
    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image is larger than 8 MB.")
    try:
        result = verify_kenyan_id(data, full_name, id_number, date_of_birth)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return result.to_dict()


@app.get("/misuse/model-info", response_model=ModelInfo)
def misuse_model_info():
    try:
        return scoring.model_info()
    except scoring.ModelsNotAvailable as exc:
        raise HTTPException(503, str(exc)) from exc


@app.post("/misuse/score", response_model=ScoreResponse)
def misuse_score(req: ScoreRequest):
    """Score SIM-days. Send each SIM's earlier days too (history); use score_from to return only new days."""
    if len(req.daily) > MAX_DAILY_ROWS or len(req.events) > MAX_EVENTS:
        raise HTTPException(413, f"At most {MAX_DAILY_ROWS:,} daily rows and {MAX_EVENTS:,} events per request.")
    daily = pd.DataFrame([r.model_dump() for r in req.daily])
    events = pd.DataFrame([e.model_dump() for e in req.events], columns=EVENT_COLUMNS)
    daily["sim_id"] = daily["sim_id"].astype(str)    # 7 and "7" are the same SIM
    events["sim_id"] = events["sim_id"].astype(str)
    try:
        result = scoring.score(daily, events, score_from=req.score_from, alerts_only=req.alerts_only)
        version = scoring.load_models().meta["model_version"]
    except scoring.ModelsNotAvailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except scoring.BadInput as exc:
        raise HTTPException(422, str(exc)) from exc

    rows = []
    for r in result.to_dict(orient="records"):
        conf = r["confidence"]
        r["confidence"] = None if conf is None or (isinstance(conf, float) and math.isnan(conf)) else round(conf, 4)
        for k in ("misuse_score", "data_anomaly_score", "call_anomaly_score"):
            r[k] = round(float(r[k]), 4)
        rows.append(r)
    counts = result["alert_level"].value_counts().to_dict() if len(result) else {}
    dates = pd.to_datetime(daily["date"]).dt.strftime("%Y-%m-%d")
    return {
        "model_version": version,
        "sims": int(daily["sim_id"].nunique()),
        "days_scored": int((dates >= pd.to_datetime(req.score_from).strftime("%Y-%m-%d")).sum()
                           if req.score_from else len(daily)),
        "alert_counts": {lvl: int(counts.get(lvl, 0)) for lvl in scoring.ALERT_LEVELS},
        "results": rows,
    }
