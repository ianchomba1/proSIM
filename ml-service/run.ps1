# Start the proSIM ML service (OCR + misuse detection) on http://127.0.0.1:8001
Set-Location $PSScriptRoot
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
