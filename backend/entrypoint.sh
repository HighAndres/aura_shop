#!/bin/sh
set -e

# Espera básica a la base (reintentos de alembic) y aplica migraciones.
echo "Aplicando migraciones..."
alembic upgrade head

# Arranca el servidor de producción. --forwarded-allow-ips para que el rate
# limiting use la IP real detrás del proxy (nginx pasa X-Forwarded-For).
echo "Arrancando gunicorn..."
exec gunicorn app.main:app \
    -k uvicorn.workers.UvicornWorker \
    -b 0.0.0.0:8000 \
    -w "${WEB_CONCURRENCY:-3}" \
    --forwarded-allow-ips="*"
