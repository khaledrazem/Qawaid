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

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "debug"]
