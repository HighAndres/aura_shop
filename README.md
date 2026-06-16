# Aura

Marketplace de productos de belleza y cuidado personal. Odoo es la fuente de verdad (ERP);
el marketplace es un canal de venta que sincroniza catálogo/precios/stock desde Odoo y
empuja pedidos hacia Odoo.

## Estructura

```
backend/    API FastAPI + PostgreSQL + SQLAlchemy 2.0 + Alembic
frontend/   Next.js 14 + TypeScript + Tailwind + shadcn/ui (próximamente)
```

## Backend — puesta en marcha (Windows / PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Configuración
copy .env.example .env   # ajustar credenciales de PostgreSQL

# Base de datos
python scripts\create_db.py      # crea la base 'aura'
alembic upgrade head             # aplica migraciones
python scripts\seed_rbac.py      # roles y permisos base

# Servidor
uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000
- Docs: http://127.0.0.1:8000/docs
- Health: `/health` (liveness) · `/health/db` (readiness)

## Notas

- `bcrypt` está fijado en `4.0.1` por compatibilidad con `passlib`.
- Los modelos incluyen campos puente para Odoo (`external_id`, `sync_status`,
  `last_synced_at`); la integración real (n8n / XML-RPC) va en una capa aparte.
