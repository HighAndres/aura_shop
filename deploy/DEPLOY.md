# Despliegue de Aura en mirmiapps (VPS Linux + Docker + nginx)

Arquitectura: **un solo subdominio** (`aura.mirmiapps.com`) servido por **nginx
del host**, que hace de proxy a dos contenedores (Next.js y FastAPI) y una base
PostgreSQL, todo en `docker compose`. Como front y API comparten origen, **no hay
CORS** y la **cookie httpOnly del refresh token funciona** de forma natural.

```
internet → nginx (host, HTTPS) ─┬─ /api,/docs,/health → backend  (127.0.0.1:8000)
                                └─ /                    → frontend (127.0.0.1:3000)
                                                          backend → db (Postgres)
```

## 1. Prerrequisitos en el servidor

```bash
# Docker + plugin compose
curl -fsSL https://get.docker.com | sh

# nginx + certbot (Ubuntu/Debian)
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```

**DNS**: crea un registro **A** de `aura.mirmiapps.com` apuntando a la IP del VPS.

## 2. Clonar el proyecto

```bash
git clone git@github.com:HighAndres/aura_shop.git
cd aura_shop
```

## 3. Configurar variables (¡cambia los valores!)

```bash
# Compose (Postgres + URL pública del API)
cp deploy/.env.example deploy/.env
nano deploy/.env            # POSTGRES_PASSWORD y NEXT_PUBLIC_API_URL=https://TU-SUBDOMINIO/api/v1

# Backend de producción
cp backend/.env.prod.example backend/.env.prod
# Genera una SECRET_KEY:
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
nano backend/.env.prod      # pega SECRET_KEY, ajusta BACKEND_CORS_ORIGINS/FRONTEND_URL al subdominio
```

Edita también `deploy/nginx-aura.conf` con tu `server_name` real.

> El subdominio en `NEXT_PUBLIC_API_URL` se **hornea** en el build del front; si lo
> cambias después, reconstruye el frontend.

## 4. Levantar el stack

```bash
cd deploy
docker compose --env-file .env up -d --build
```

El backend aplica las **migraciones** solo al arrancar (entrypoint) y queda en
`127.0.0.1:8000`; el frontend en `127.0.0.1:3000`.

## 5. Datos iniciales

```bash
docker compose exec backend python scripts/seed_rbac.py        # roles y permisos (OBLIGATORIO)
docker compose exec backend python scripts/seed_catalog.py     # catálogo demo (opcional)
docker compose exec backend python scripts/seed_inventory.py   # stock demo (opcional)

# Superadmin REAL (no uses seed_admins en producción):
docker compose exec -e AURA_EMAIL='tu@correo.com' -e AURA_PASSWORD='UNA-CLAVE-FUERTE' \
  -e AURA_ROL=superadmin backend python scripts/crear_usuario.py
```

## 6. nginx + HTTPS

```bash
sudo cp deploy/nginx-aura.conf /etc/nginx/sites-available/aura
sudo ln -s /etc/nginx/sites-available/aura /etc/nginx/sites-enabled/aura
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d aura.mirmiapps.com   # obtiene el SSL y fuerza HTTPS
```

## 7. Verificar

- Tienda: `https://aura.mirmiapps.com`
- API docs: `https://aura.mirmiapps.com/docs`
- Inicia sesión con tu superadmin → panel en el icono ▦ o `/admin`.

## 8. Actualizar (nuevas versiones)

```bash
git pull
cd deploy && docker compose --env-file .env up -d --build
```

## 9. Backups de la base (recomendado)

```bash
# Volcado manual
docker compose exec db pg_dump -U aura aura > aura_$(date +%F).sql
# Programa un cron diario con esto.
```

## Notas de seguridad
- `DEBUG=false` y `ENVIRONMENT=production` (ya en `.env.prod.example`): apaga la fuga
  de `dev_token` y el echo de SQL.
- La cookie del refresh sale `Secure` automáticamente en producción (requiere HTTPS).
- Pendientes para correo real (verificación/reset): configurar **SMTP** y poner
  `EMAILS_ENABLED=true`.
