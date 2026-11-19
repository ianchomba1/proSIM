# ProSIM simulated operator: runs once and exits (an Azure Container Apps scheduled job).
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY generator.py main.py ./
ENTRYPOINT ["python", "main.py"]
