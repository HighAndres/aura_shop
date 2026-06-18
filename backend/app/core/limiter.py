"""Limitador de tasa (rate limiting) compartido."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Clave por IP de origen. En producción detrás de proxy, asegurar que la IP
# real llegue (X-Forwarded-For) configurando el proxy/uvicorn correctamente.
limiter = Limiter(key_func=get_remote_address)
