# proSIM ML service

Python FastAPI service used by the ASP.NET backend for **Kenyan National ID OCR verification**
during SIM registration (Tesseract). It binds to `127.0.0.1:8001`; only the backend should call it.

The misuse-detection models (Isolation Forest + Random Forest) will be trained in Google Colab
later; they are not part of this service yet.

## Setup (once)

```powershell
winget install UB-Mannheim.TesseractOCR
cd ml-service
python -m venv .venv
.\.venv\Scripts\python -m pip install fastapi "uvicorn[standard]" python-multipart pytesseract pillow opencv-python-headless rapidfuzz
```

## Run

```powershell
.\ml-service\run.ps1          # ML service on http://127.0.0.1:8001
dotnet run --project backend  # API on http://localhost:5000
npm run dev                   # frontend
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service status |
| POST | `/ocr/kenyan-id/verify` | Multipart: `image`, `full_name`, `id_number`, `date_of_birth` → per-field match |

The backend exposes this to the frontend as `POST /api/verification/national-id`, which issues a
15-minute single-use token required by `POST /api/applications`.
