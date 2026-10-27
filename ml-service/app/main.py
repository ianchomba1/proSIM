"""
proSIM ML service: Kenyan ID OCR verification.

Misuse-detection models (Isolation Forest + Random Forest) will be added later.

Run (from ml-service/):
    .venv\\Scripts\\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
Only the ASP.NET backend should call this service; it binds to localhost.
"""
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .ocr import verify_kenyan_id

MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

app = FastAPI(title="proSIM ML service", version="1.0.0")


@app.get("/health")
def health():
    return {"status": "ok"}


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
