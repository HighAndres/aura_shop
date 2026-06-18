"""Checkout: convierte un carrito en pedido y descuenta inventario (atómico)."""

import uuid
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.crud import inventory as crud_inv
from app.models.cart import Carrito
from app.models.catalog import Variante
from app.models.inventory import StockMovimiento, TipoMovimiento
from app.models.order import EstadoPedido, Pedido, PedidoItem
from app.schemas.order import CheckoutIn

ALMACEN_CHECKOUT = "PRINCIPAL"

# Transiciones de estado permitidas (máquina de estados del pedido).
TRANSICIONES: dict[str, set[str]] = {
    "pendiente": {"pagado", "cancelado"},
    "pagado": {"enviado", "cancelado"},
    "enviado": {"entregado"},
    "entregado": set(),
    "cancelado": set(),
}


class TransicionInvalidaError(Exception):
    """El cambio de estado solicitado no está permitido."""


class CheckoutError(Exception):
    """Error genérico de checkout."""


class CarritoVacioError(CheckoutError):
    pass


class SinAlmacenError(CheckoutError):
    pass


class StockInsuficienteCheckout(CheckoutError):
    def __init__(self, faltantes: list[tuple[str, int, int]]):
        self.faltantes = faltantes
        detalle = ", ".join(
            f"{sku} (disp. {disp}, pedido {ped})" for sku, disp, ped in faltantes
        )
        super().__init__(f"Stock insuficiente: {detalle}")


def _siguiente_numero(db: Session) -> str:
    n = db.scalar(select(func.count()).select_from(Pedido)) or 0
    return f"AURA-{n + 1:06d}"


def _etiqueta_variante(v) -> str:
    etiqueta = v.nombre or " · ".join(
        f"{val.atributo.nombre}: {val.valor}" for val in v.valores
    )
    return f"{v.producto.nombre}" + (f" — {etiqueta}" if etiqueta else "")


def checkout(
    db: Session,
    cart: Carrito,
    data: CheckoutIn,
    *,
    usuario_id: uuid.UUID | None,
    email_cuenta: str | None,
) -> Pedido:
    if cart is None or not cart.items:
        raise CarritoVacioError("El carrito está vacío")

    almacen = crud_inv.get_almacen_by_codigo(db, ALMACEN_CHECKOUT)
    if almacen is None:
        raise SinAlmacenError(f"No existe el almacén {ALMACEN_CHECKOUT}")

    email = data.email or email_cuenta
    if not email:
        raise CheckoutError("Se requiere un correo para el pedido")

    # Candado anti-sobreventa: bloqueo pesimista de las variantes del carrito.
    # Serializa checkouts simultáneos de los mismos SKU hasta el commit, para
    # que la validación de stock y el descuento sean consistentes.
    variante_ids = [it.variante_id for it in cart.items]
    db.execute(
        select(Variante.id).where(Variante.id.in_(variante_ids)).with_for_update()
    )

    # 1) Validar stock de todas las líneas antes de tocar nada.
    faltantes: list[tuple[str, int, int]] = []
    for it in cart.items:
        disp = crud_inv.disponible(db, it.variante_id, almacen.id)
        if disp < it.cantidad:
            faltantes.append((it.variante.sku, disp, it.cantidad))
    if faltantes:
        raise StockInsuficienteCheckout(faltantes)

    # 2) Crear pedido + items (snapshot) + movimientos de salida.
    numero = _siguiente_numero(db)
    pedido = Pedido(
        numero=numero,
        usuario_id=usuario_id,
        email=email,
        estado="pendiente",
        nombre_contacto=data.nombre_contacto,
        telefono=data.telefono,
        direccion_calle=data.direccion_calle,
        direccion_ciudad=data.direccion_ciudad,
        direccion_estado=data.direccion_estado,
        direccion_cp=data.direccion_cp,
        notas=data.notas,
        requiere_factura=data.requiere_factura,
        rfc=data.rfc,
        razon_social=data.razon_social,
        regimen_fiscal=data.regimen_fiscal,
        uso_cfdi=data.uso_cfdi,
        cp_fiscal=data.cp_fiscal,
        subtotal=Decimal("0.00"),
        envio=Decimal("0.00"),
        total=Decimal("0.00"),
    )

    subtotal = Decimal("0.00")
    for it in cart.items:
        v = it.variante
        linea = (v.precio * it.cantidad).quantize(Decimal("0.01"))
        subtotal += linea
        pedido.items.append(
            PedidoItem(
                variante_id=v.id,
                sku=v.sku,
                nombre=_etiqueta_variante(v),
                cantidad=it.cantidad,
                precio_unitario=v.precio,
                subtotal=linea,
            )
        )
        db.add(
            StockMovimiento(
                variante_id=v.id,
                almacen_id=almacen.id,
                tipo=TipoMovimiento.SALIDA.value,
                cantidad=-it.cantidad,
                referencia=numero,
                nota="Venta (checkout)",
            )
        )

    pedido.subtotal = subtotal
    pedido.total = subtotal + pedido.envio
    db.add(pedido)

    cart.estado = "convertido"

    db.commit()
    db.refresh(pedido)
    return pedido


# --- Gestión por el personal ---

def list_pedidos(
    db: Session,
    *,
    estado: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Pedido], int]:
    stmt: Select = select(Pedido)
    if estado:
        stmt = stmt.where(Pedido.estado == estado)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Pedido.numero.ilike(like) | Pedido.email.ilike(like))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = list(
        db.scalars(
            stmt.order_by(Pedido.created_at.desc()).limit(limit).offset(offset)
        ).all()
    )
    return items, total or 0


def get_pedido_by_numero(db: Session, numero: str) -> Pedido | None:
    return db.scalar(select(Pedido).where(Pedido.numero == numero))


def cambiar_estado(db: Session, pedido: Pedido, nuevo: str) -> str:
    """Cambia el estado validando la transición. Devuelve el estado anterior."""
    if nuevo not in TRANSICIONES.get(pedido.estado, set()):
        raise TransicionInvalidaError(
            f"No se puede pasar de '{pedido.estado}' a '{nuevo}'"
        )
    anterior = pedido.estado
    pedido.estado = nuevo
    db.commit()
    db.refresh(pedido)
    return anterior


def cancelar_pedido(db: Session, pedido: Pedido) -> str:
    """Cancela el pedido y reabastece el inventario (entradas reversa)."""
    if "cancelado" not in TRANSICIONES.get(pedido.estado, set()):
        raise TransicionInvalidaError(
            f"No se puede cancelar un pedido en estado '{pedido.estado}'"
        )
    anterior = pedido.estado
    almacen = crud_inv.get_almacen_by_codigo(db, ALMACEN_CHECKOUT)
    for it in pedido.items:
        if it.variante_id is None or almacen is None:
            continue
        db.add(
            StockMovimiento(
                variante_id=it.variante_id,
                almacen_id=almacen.id,
                tipo=TipoMovimiento.ENTRADA.value,
                cantidad=it.cantidad,
                referencia=pedido.numero,
                nota="Reabasto por cancelación",
            )
        )
    pedido.estado = "cancelado"
    db.commit()
    db.refresh(pedido)
    return anterior
