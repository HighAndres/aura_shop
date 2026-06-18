"""Agregaciones para los reportes de operación."""

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalog import Producto, Variante
from app.models.inventory import StockMovimiento
from app.models.order import Pedido, PedidoItem


def ventas_resumen(db: Session) -> dict:
    num = db.scalar(select(func.count()).select_from(Pedido)) or 0
    ingresos = db.scalar(select(func.coalesce(func.sum(Pedido.total), 0))) or Decimal("0")
    ingresos = Decimal(ingresos)
    ticket = (ingresos / num).quantize(Decimal("0.01")) if num else Decimal("0.00")

    por_estado = dict(
        db.execute(
            select(Pedido.estado, func.count()).group_by(Pedido.estado)
        ).all()
    )
    return {
        "num_pedidos": num,
        "ingresos": ingresos,
        "ticket_promedio": ticket,
        "por_estado": por_estado,
    }


def top_productos(db: Session, limit: int = 10) -> list[tuple[str, str, int, Decimal]]:
    rows = db.execute(
        select(
            PedidoItem.sku,
            func.max(PedidoItem.nombre),
            func.sum(PedidoItem.cantidad),
            func.sum(PedidoItem.subtotal),
        )
        .group_by(PedidoItem.sku)
        .order_by(func.sum(PedidoItem.cantidad).desc())
        .limit(limit)
    ).all()
    return [(sku, nombre, int(cant), Decimal(ing)) for sku, nombre, cant, ing in rows]


def stock_bajo(db: Session, umbral: int = 5) -> list[tuple[str, str, int]]:
    disponible = func.coalesce(func.sum(StockMovimiento.cantidad), 0)
    rows = db.execute(
        select(Variante.sku, Producto.nombre, disponible)
        .join(Producto, Variante.producto_id == Producto.id)
        .outerjoin(StockMovimiento, StockMovimiento.variante_id == Variante.id)
        .where(Variante.activo.is_(True))
        .group_by(Variante.sku, Producto.nombre)
        .having(disponible <= umbral)
        .order_by(disponible.asc())
    ).all()
    return [(sku, prod, int(disp)) for sku, prod, disp in rows]
