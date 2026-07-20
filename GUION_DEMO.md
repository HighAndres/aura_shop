# Guion para una demo exitosa — Aura Shop

Sitio: **https://aurashop.mirmiapps.com** · Desplegado: PR #10 (`021e622`), 20 jul 2026.
La idea central que la demo debe transmitir: **cada rol ve solo lo suyo, y ningún
pedido se marca "pagado" solo** — que era la queja original de la clienta.

---

## 1. Un día antes — verificación técnica (15 min)

- [ ] Abrir https://aurashop.mirmiapps.com — la tienda carga con productos e imágenes.
- [ ] Entrar con cada usuario y confirmar la matriz:

| # | Rol | Qué comprobar |
|---|-----|---------------|
| 1 | Vendedor | El menú muestra **solo** Dashboard, Pedidos y Reportes. Nada de Productos, Inventario, Paquetes, Usuarios ni Bitácora. |
| 2 | Vendedor | En "Levantar pedido", buscar por **SKU** encuentra el producto. |
| 3 | Vendedor | El pedido levantado queda en **`pendiente`**, no en `pagado`. |
| 4 | Admin | Al abrir un pedido pendiente **no** hay botón "Marcar pagado" (solo cancelar/enviar). |
| 5 | Super Admin | **Sí** puede marcar pagado, y el detalle muestra el historial de estados. |

- [ ] Si el menú del vendedor sale **vacío**: frontend y backend desalineados — revisar el Paso 4 del [DEPLOY_RUNBOOK.md](DEPLOY_RUNBOOK.md) (en el VPS es `pm2 restart aura-backend`, no systemd).
- [ ] **Cancelar los pedidos de prueba que queden en `pendiente`** — reservan stock y ensucian los reportes que se enseñarán en la demo.
- [ ] Verificar que hay stock suficiente en los productos que se usarán en vivo.
- [ ] Descargar un reporte Excel de prueba (ventas e inventario) para confirmar que el botón funciona.

## 2. Justo antes de empezar (5 min)

- [ ] Tener **dos navegadores o un perfil normal + incógnito**: uno con sesión de vendedor, otro de admin/superadmin. Cambiar de rol en vivo cerrando sesión se ve lento.
- [ ] **Ojo con el logout por inactividad (30 min):** las sesiones abiertas "de antemano" se cierran solas. Iniciar sesión máximo unos minutos antes de la demo, no una hora antes.
- [ ] Probar la vista móvil si la clienta la va a pedir (el buscador móvil con overlay es de los features nuevos).
- [ ] Tener a la mano un pedido ya `pagado` y otro `enviado` para que los reportes y el historial no se vean vacíos.

## 3. Chuleta de datos (verificados en la base el 20 jul 2026)

### Usuarios para la demo (contraseñas: en tu gestor, no van aquí)

| Rol | Usuario sugerido |
|-----|------------------|
| Super Admin | `superadmin@aurashop.mirmiapps.com` |
| Admin | `admin@aurashop.mirmiapps.com` |
| Vendedor | `vendedor@aurashop.mirmiapps.com` |
| Cliente | `cliente@aurashop.mirmiapps.com` |

También existen `*@mirmibug.com` (admin, superadmin, vendedor) y `admin@aura.mx`
(superadmin) — usar un solo juego para no confundirse en vivo.

### SKUs para levantar pedidos en vivo (con stock de sobra)

| SKU | Producto | Precio | Stock | Por qué este |
|-----|----------|--------|-------|--------------|
| `LAB-MATE-ROJO` | Labial Mate Larga Duración (Tono Rojo) | $199 | 50 | Tiene **3 variantes** (Rojo/Nude/Coral) — luce el selector de variantes |
| `PALETA-SUNSET-001` | Paleta de Sombras Sunset | $399 | 60 | Destacado en el home; fácil de mostrar tienda → pedido |
| `SERUM-VITC-30ML` | Serum Vitamina C 30 ml | $399 | 40 | Variantes por tamaño (30/50 ml, precio distinto) |
| `SOLAR-SPF50-001` | Protector Solar SPF 50+ | $459 | 56 | Destacado, marca reconocible (La Roche-Posay) |
| `BRUMA-100` | Bruma Facial Hidratante | $149 | 80 | El de mayor stock — el "seguro" si algo falla |

Ticket bonito para el cierre: paleta + labial + serum ≈ $997.

### Pedidos existentes para enseñar estados e historial

| Número | Estado | Total | Sirve para |
|--------|--------|-------|------------|
| `AURA-000008` | entregado | $189 | Ciclo completo con historial |
| `AURA-000007` | pagado | $289 | Mostrar un pedido pagado reciente (14 jul) |
| `AURA-000002` | enviado | $1,248 | Vista de admin: acciones sobre enviado |
| `AURA-000005` | cancelado | $846 | Mostrar que cancelar restaura stock |

### Limpieza pendiente ANTES de la demo (detectada el 20 jul)

- [ ] **`AURA-000004`** lleva `pendiente` desde el **21 de junio** ($1,506) — está
  reservando stock. Cancelarlo (y de paso es el ejemplo perfecto de por qué viene
  el job de expiración en la fase de pagos).
- [ ] El producto **`0001` / "bloqueador solar"** ($300) es basura de pruebas: nombre
  en minúsculas, SKU `0001`, duplica al Protector Solar real. Desactivarlo para que
  no salga en el catálogo durante la demo.
- [ ] `admin@aurashop.mirmiapps.com` tiene roles `administrador` **e** `invitado` a la
  vez — revisar que no cause rarezas en el menú; si estorba, quitarle `invitado`.

## 4. Guion sugerido (20–30 min)

### a) La tienda (como cliente final) — 5 min
1. Home, categorías, buscador (probar también en móvil: el overlay expandible).
2. Ficha de producto → carrito → checkout. Mencionar: "se puede comprar con o sin cuenta".
3. Rematar: el pedido queda **pendiente de pago** — nadie lo marca pagado a mano.

### b) El vendedor — 8 min (la estrella de la demo)
1. Entrar como vendedor: enseñar que el menú es **corto a propósito** — solo lo que necesita.
2. Levantar un pedido en vivo buscando por SKU (usar `LAB-MATE-ROJO` — ver chuleta).
3. Mostrar que nace en `pendiente` y explicar el flujo real: *"el vendedor le pasa
   al cliente un link de pago; cuando el banco confirma, el sistema lo marca pagado solo"*.
4. Reportes del vendedor: **solo ve sus propias ventas**, y las puede bajar en Excel.

### c) Operación y control — 8 min
1. Como Admin: gestión de pedidos (cancelar, enviar) y mostrar que **ni el Admin
   puede marcar pagado** — conectar explícitamente con su queja: *"esto responde a
   lo que nos pediste: ya nada aparece pagado sin proceso bancario"*.
2. Como Super Admin: la "escotilla" de marcar pagado manual **queda en bitácora**
   con quién y cuándo — control, no agujero.
3. Historial de estados de un pedido: quién movió qué y en qué momento.
4. Reportes completos + descarga en Excel (ventas e inventario).

### d) Cierre — 3 min
- Resumen: roles reales, pedidos con trazabilidad, reportes por rol.
- Siguiente fase (ver sección 4): pasarela de pagos.

## 5. Preguntas que van a salir — y la respuesta acordada

- **"¿Y cómo se cobra?"** → Fase siguiente: Mercado Pago. El vendedor manda un link
  de pago y el sistema marca `pagado` automático vía webhook — el enganche técnico
  ya está listo (la máquina de estados y el campo `origen` en el historial).
  *Pendiente nuestro: iniciar el alta de la cuenta de Mercado Pago ya — pide RFC y tarda días.*
- **"¿Qué métodos de pago va a haber?"** → Por definir con ella en la fase de pagos
  (tarjeta / OXXO / SPEI / MSI). Buena oportunidad para preguntárselo en la demo.
- **"¿Qué pasa si un pedido nunca se paga?"** → Hoy reserva stock hasta que alguien
  lo cancela; con la fase de pagos entra la expiración automática (`origen=SISTEMA`).
  Decirlo proactivamente si pregunta por inventario — es mejor que lo oiga de nosotros.
- **"¿Puedo darle permiso X a tal persona?"** → Sí: los permisos son por rol y el
  Super Admin los administra. **No prometer** en vivo darle "marcar pagado" a un rol
  operativo — es exactamente lo que se cerró a propósito.
- **Odoo** → scopeado aparte, después de la demo.

## 6. Si algo falla en vivo

- **Menú vacío / errores raros tras login** → refrescar con Cmd+Shift+R primero;
  si persiste, es señal de backend: `ssh andresadmin@69.6.207.137 -p 22022` y
  `pm2 restart aura-backend && pm2 restart aura-frontend` (backend primero, siempre).
- **Se cerró la sesión a media demo** → es el logout de 30 min de inactividad;
  volver a entrar y seguir. Venderlo como feature de seguridad si lo notan.
- **Un producto sin stock** → cambiar a otro de los destacados; no detenerse a explicar.
- **El sitio no responde** → salud del backend: `curl http://127.0.0.1:8000/health`
  y `/health/db` desde el VPS. Backup de la base disponible en `~/aura_backup_*.sql`.
- Regla general: si algo se rompe, **anotar y seguir con el guion** — no debuggear
  frente a la clienta.
