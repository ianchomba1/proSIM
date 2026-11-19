# ProSIM ML service: misuse models + Kenyan ID OCR (needs the Tesseract program).
# Build context: the ml-service folder. The trained models are git-ignored, so build from the
# laptop folder that holds ml-service/models (not from a fresh clone).
FROM python:3.14-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY models ./models
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
