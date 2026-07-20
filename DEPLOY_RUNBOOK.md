# Runbook de despliegue — RBAC + máquina de estados (PR #10)

Ambiente: **VPS con SSH**, solo demo, sin ventas reales.
Objetivo: llevar `main` (commit `021e622`) al servidor, correr **2 migraciones**
y el **seed de permisos**, en el orden correcto.

> **Regla de oro:** el backend sube ANTES que el frontend. Si el frontend nuevo
> queda contra el backend viejo, `/users/me` no devuelve `permisos` y **el menú
> del panel sale vacío para todos**, incluida la cliente.

Antes de empezar, sustituye estos valores por los tuyos:

- `RUTA_REPO` — dónde está clonado el repo en el VPS (p. ej. `/opt/aura_shop`)
- `SERVICIO_BACKEND` — el nombre del servicio systemd del backend (p. ej. `aura-backend`)
- `SERVICIO_FRONTEND` — cómo se sirve el frontend (systemd, pm2, o build estático)

Si no sabes los nombres de los servicios, este comando te los muestra:

```
systemctl list-units --type=service | grep -iE "aura|uvicorn|next|node"
```

---

## Paso 0 — Backup de la base (obligatorio, aunque sea demo)

Las migraciones alteran el esquema. Un backup toma segundos y te salva de una tarde mala.

```
ssh TU_VPS
cd RUTA_REPO/backend
set -a; source .env; set +a
pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB" > ~/aura_backup_$(date +%Y%m%d_%H%M).sql
ls -lh ~/aura_backup_*.sql
```

Debe aparecer un archivo con tamaño mayor a 0. Si `pg_dump` pide contraseña,
es la de `POSTGRES_PASSWORD` de tu `.env`.

---

## Paso 1 — Traer el código nuevo

```
cd RUTA_REPO
git fetch origin
git checkout main
git pull --ff-only origin main
git log --oneline -1
```

La última línea debe mostrar `021e622` (el merge del PR #10).

---

## Paso 2 — Backend: dependencias y migraciones

```
cd RUTA_REPO/backend
source .venv/bin/activate
pip install -r requirements.txt
```

Ver en qué versión está la base ANTES de migrar:

```
PYTHONPATH=. alembic current
```

Aplicar las dos migraciones:

```
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. alembic current
```

Tras el upgrade, `alembic current` debe mostrar `b7825710b072 (head)`.
Esto crea la tabla `pedido_estado_historial` y agrega RFC/dirección a usuarios.

---

## Paso 3 — Seed de permisos (EL PASO QUE NO SE PUEDE OLVIDAR)

Sin esto, la matriz nueva de permisos no existe y los roles conservan los
permisos viejos: el despliegue no habría servido de nada.

```
cd RUTA_REPO/backend
PYTHONPATH=. python scripts/seed_rbac.py
```

Debe imprimir algo como:

```
Seed OK: 28 permisos, 5 roles (superadmin, administrador, vendedor, cliente, invitado).
Permisos obsoletos retirados: 1
```

El seed es idempotente: si lo corres dos veces, no duplica nada.

---

## Paso 4 — Reiniciar el backend

```
sudo systemctl restart SERVICIO_BACKEND
sudo systemctl status SERVICIO_BACKEND --no-pager
```

Debe decir `active (running)`. Verificar que responde:

```
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health
```

Debe devolver `200`. (El health va sin el prefijo `/api/v1`, a diferencia del
resto de la API.) Para comprobar además que la BD responde:

```
curl -s http://127.0.0.1:8000/health/db
```

---

## Paso 5 — Frontend (SOLO después de que el backend ya esté arriba)

Si el frontend se construye en el VPS:

```
cd RUTA_REPO/frontend
npm ci
npm run build
sudo systemctl restart SERVICIO_FRONTEND
```

Si el frontend está en Vercel/Netlify y auto-despliega desde `main`, ya se
actualizó solo con el merge. En ese caso este paso es solo confirmar que el
deploy del frontend terminó DESPUÉS de que el backend quedó arriba. Si el
frontend se desplegó antes que el backend, vuelve a lanzar su build ahora.

---

## Paso 6 — Verificación en vivo

Abre el panel en el navegador y entra con cada rol:

1. **Vendedor** — debe ver solo Dashboard, Pedidos y Reportes. No debe aparecer
   Productos, Inventario, Paquetes, Usuarios ni Bitácora.
2. **Vendedor** — en "Levantar pedido", teclea un SKU (no el nombre): debe
   encontrar el producto.
3. **Vendedor** — el pedido que levante debe quedar en `pendiente`, no en `pagado`.
4. **Admin** — al abrir un pedido pendiente NO debe tener botón de "Marcar pagado".
5. **Super Admin** — sí puede marcar pagado (la escotilla), y el detalle del
   pedido muestra el historial de estados.

Si el menú del vendedor sale **vacío**, es la señal de que el frontend está
corriendo contra el backend viejo: revisa que el Paso 4 haya quedado bien.

---

## Si algo sale mal: revertir

Revertir la base al backup del Paso 0:

```
cd RUTA_REPO/backend
set -a; source .env; set +a
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" < ~/aura_backup_AAAAMMDD_HHMM.sql
```

Revertir solo las migraciones (sin tocar datos previos), una a una:

```
PYTHONPATH=. alembic downgrade -1
PYTHONPATH=. alembic downgrade -1
```

Revertir el código al estado anterior al merge:

```
cd RUTA_REPO
git checkout 5ae4d4d
```

Ambas migraciones fueron probadas en `upgrade` y `downgrade` antes de mergear.

---

## Nota para después de la demo

La venta directa del vendedor ahora nace `pendiente` y solo el Super Admin
puede marcarla pagada (a mano). Eso es correcto: el pago automático se quitó a
propósito. Cuando entre la pasarela (Mercado Pago, pospuesto), el webhook hará
esa transición solo y la escotilla del Super Admin deja de ser necesaria.
