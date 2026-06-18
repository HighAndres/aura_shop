# Backend Aura — FastAPI
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencias primero (mejor caché de capas)
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN chmod +x entrypoint.sh

EXPOSE 8000

# Aplica migraciones y arranca gunicorn (workers uvicorn)
CMD ["./entrypoint.sh"]
