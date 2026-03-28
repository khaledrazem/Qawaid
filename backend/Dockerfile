# Qawaid backend with Python 3.12 + CAMeL Tools (morphology works in container).
FROM python:3.12-slim

# Build tools for camel-kenlm and other wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first (better layer cache)
COPY requirements.txt requirements-camel.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-camel.txt

# CAMeL data (in container so you only need: docker compose build / docker compose up --build)
ENV HOME=/root
RUN camel_data -i morphology-db-msa-r13 \
    && camel_data -i disambig-mle-calima-msa-r13

# Application
COPY . .

# Cloud Run sets PORT (default 8080). Local: docker run -e PORT=8000 -p 8000:8000 …
EXPOSE 8080

# JSON CMD cannot expand $PORT; use shell so we bind the port Cloud Run expects.
CMD ["sh", "-c", "exec python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --log-level info"]
