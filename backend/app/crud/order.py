"""Checkout: convierte un carrito en pedido y descuenta inventario (atómico)."""

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.order_state import registrar_creacion
from app.crud import bundle as crud_bundle
from app.crud import inventory as crud_inv
from app.models.cart import Carrito
from app.models.catalog import Variante
from app.models.inventory import StockMovimiento, TipoMovimiento
from app.models.order import OrigenTransicion, Pedido, PedidoItem
from app.schemas.order import CheckoutIn

ALMACEN_CHECKOUT = "PRINCIPAL"


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
    ultimo = db.scalar(
        select(Pedido.numero).order_by(Pedido.numero.desc()).limit(1)
    )
    if ultimo:
        n = int(ultimo.split("-")[-1])
    else:
        n = 0
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
    if cart is None or (not cart.items and not cart.paquetes):
        raise CarritoVacioError("El carrito está vacío")

    almacen = crud_inv.get_almacen_by_codigo(db, ALMACEN_CHECKOUT)
    if almacen is None:
        raise SinAlmacenError(f"No existe el almacén {ALMACEN_CHECKOUT}")

    email = data.email or email_cuenta
    if not email:
        raise CheckoutError("Se requiere un correo para el pedido")

    # Resolver los paquetes a sus variantes concretas (para inventario).
    componentes_por_paquete: dict[uuid.UUID, list[tuple[Variante, int]]] = {}
    for lp in cart.paquetes:
        if not lp.paquete.activo:
            raise CheckoutError(
                f"El paquete {lp.paquete.nombre} ya no está disponible; "
                "quítalo del carrito para continuar"
            )
        try:
            componentes_por_paquete[lp.id] = crud_bundle.componentes(lp.paquete)
        except crud_bundle.PaqueteSinVarianteError as exc:
            raise CheckoutError(str(exc)) from exc

    # Necesidad total por variante: items sueltos + componentes de paquetes.
    necesidad: dict[uuid.UUID, int] = {}
    sku_por_variante: dict[uuid.UUID, str] = {}
    for it in cart.items:
        necesidad[it.variante_id] = necesidad.get(it.variante_id, 0) + it.cantidad
        sku_por_variante[it.variante_id] = it.variante.sku
    for lp in cart.paquetes:
        for v, cant in componentes_por_paquete[lp.id]:
            necesidad[v.id] = necesidad.get(v.id, 0) + cant * lp.cantidad
            sku_por_variante[v.id] = v.sku

    # 1) Bloquear variantes y validar stock (FOR UPDATE evita sobreventa).
    variante_ids = list(necesidad)
    db.execute(
        select(StockMovimiento.variante_id)
        .where(StockMovimiento.variante_id.in_(variante_ids))
        .with_for_update()
    )

    faltantes: list[tuple[str, int, int]] = []
    for vid, cantidad in necesidad.items():
        disp = crud_inv.disponible(db, vid, almacen.id)
        if disp < cantidad:
            faltantes.append((sku_por_variante[vid], disp, cantidad))
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

    # Paquetes: una línea al precio del paquete; el inventario sale por
    # componente (el pedido conserva qué variantes se descontaron vía los
    # movimientos con referencia = número de pedido).
    for lp in cart.paquetes:
        p = lp.paquete
        linea = (p.precio_paquete * lp.cantidad).quantize(Decimal("0.01"))
        subtotal += linea
        pedido.items.append(
            PedidoItem(
                variante_id=None,
                sku=f"PAQ-{p.slug}"[:64],
                nombre=f"Paquete: {p.nombre}",
                cantidad=lp.cantidad,
                precio_unitario=p.precio_paquete,
                subtotal=linea,
            )
        )
        for v, cant in componentes_por_paquete[lp.id]:
            db.add(
                StockMovimiento(
                    variante_id=v.id,
                    almacen_id=almacen.id,
                    tipo=TipoMovimiento.SALIDA.value,
                    cantidad=-(cant * lp.cantidad),
                    referencia=numero,
                    nota=f"Venta (checkout) — paquete {p.nombre}",
                )
            )

    pedido.subtotal = subtotal
    pedido.total = subtotal + pedido.envio
    db.add(pedido)
    registrar_creacion(
        db,
        pedido,
        origen=OrigenTransicion.USUARIO,
        nota="Pedido creado desde la tienda",
    )

    cart.estado = "convertido"

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise CheckoutError("Error al generar el pedido, por favor intenta de nuevo")

    db.refresh(pedido)
    return pedido


def restaurar_inventario(db: Session, pedido: Pedido) -> None:
    """Revierte los movimientos de salida de un pedido cancelado.

    Se revierten los movimientos (no las líneas del pedido) porque las líneas
    de paquete no llevan variante: lo que salió del almacén fueron sus
    componentes, y eso solo consta en los movimientos con esta referencia.
    """
    salidas = db.scalars(
        select(StockMovimiento).where(
            StockMovimiento.referencia == pedido.numero,
            StockMovimiento.tipo == TipoMovimiento.SALIDA.value,
        )
    ).all()
    for mov in salidas:
        db.add(
            StockMovimiento(
                variante_id=mov.variante_id,
                almacen_id=mov.almacen_id,
                tipo=TipoMovimiento.ENTRADA.value,
                cantidad=-mov.cantidad,
                referencia=pedido.numero,
                nota="Devolución por cancelación",
            )
        )
