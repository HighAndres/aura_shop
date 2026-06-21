"""Endpoints de reportes administrativos: ventas e inventario."""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_permissions
from app.db.session import get_db
from app.models.catalog import Variante
from app.models.order import EstadoPedido, Pedido, PedidoItem
from app.models.inventory import StockMovimiento
from app.models.user import Usuario

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])

ADMIN_ROLES = {"superadmin", "administrador"}


# ── Schemas ────────────────────────────────────────────────────────────

class VentasDiarias(BaseModel):
    fecha: date
    pedidos: int
    total: Decimal


class VentasResumen(BaseModel):
    periodo_inicio: date
    periodo_fin: date
    total_pedidos: int
    total_ventas: Decimal
    ticket_promedio: Decimal
    por_estado: dict[str, int]
    productos_top: list[dict]
    ventas_diarias: list[VentasDiarias]


class InventarioResumen(BaseModel):
    total_skus: int
    skus_con_stock: int
    skus_sin_stock: int
    valor_inventario: Decimal
    movimientos_recientes: int
    stock_bajo: list[dict]


# ── Ventas ─────────────────────────────────────────────────────────────

def _filtros_periodo(desde: date, vendedor_id=None):
    """Devuelve condiciones comunes: periodo + no cancelado + vendedor opcional."""
    conds = [
        func.date(Pedido.created_at) >= desde,
        Pedido.estado != EstadoPedido.CANCELADO.value,
    ]
    if vendedor_id is not None:
        conds.append(Pedido.asignado_a == vendedor_id)
    return conds


@router.get(
    "/ventas",
    response_model=VentasResumen,
    summary="Resumen de ventas en un periodo",
)
def reporte_ventas(
    db: Session = Depends(get_db),
    dias: int = Query(default=30, ge=1, le=365),
    current_user: Usuario = Depends(require_permissions("reportes.leer")),
) -> VentasResumen:
    desde = date.today() - timedelta(days=dias)
    hasta = date.today()

    user_roles = {r.nombre for r in current_user.roles}
    es_admin = bool(user_roles & ADMIN_ROLES)
    vendedor_id = None if es_admin else current_user.id

    conds = _filtros_periodo(desde, vendedor_id)

    total_pedidos = db.scalar(
        select(func.count()).select_from(Pedido).where(*conds)
    ) or 0

    total_ventas = db.scalar(
        select(func.coalesce(func.sum(Pedido.total), 0)).where(*conds)
    ) or Decimal("0")

    ticket_promedio = (
        total_ventas / total_pedidos if total_pedidos > 0 else Decimal("0")
    )

    conds_all_estados = [func.date(Pedido.created_at) >= desde]
    if vendedor_id is not None:
        conds_all_estados.append(Pedido.asignado_a == vendedor_id)

    por_estado_rows = db.execute(
        select(Pedido.estado, func.count())
        .where(*conds_all_estados)
        .group_by(Pedido.estado)
    ).all()
    por_estado = {row[0]: row[1] for row in por_estado_rows}

    prod_q = (
        select(
            PedidoItem.nombre,
            func.sum(PedidoItem.cantidad).label("cantidad"),
            func.sum(PedidoItem.subtotal).label("ingresos"),
        )
        .join(Pedido, PedidoItem.pedido_id == Pedido.id)
        .where(*conds)
        .group_by(PedidoItem.nombre)
        .order_by(func.sum(PedidoItem.subtotal).desc())
        .limit(10)
    )
    productos_top = [
        {"nombre": r[0], "cantidad": int(r[1]), "ingresos": str(r[2])}
        for r in db.execute(prod_q).all()
    ]

    diarias_q = (
        select(
            func.date(Pedido.created_at).label("fecha"),
            func.count().label("pedidos"),
            func.coalesce(func.sum(Pedido.total), 0).label("total"),
        )
        .where(*conds)
        .group_by(func.date(Pedido.created_at))
        .order_by(func.date(Pedido.created_at))
    )
    ventas_diarias = [
        VentasDiarias(fecha=r[0], pedidos=r[1], total=r[2])
        for r in db.execute(diarias_q).all()
    ]

    return VentasResumen(
        periodo_inicio=desde,
        periodo_fin=hasta,
        total_pedidos=total_pedidos,
        total_ventas=total_ventas,
        ticket_promedio=ticket_promedio,
        por_estado=por_estado,
        productos_top=productos_top,
        ventas_diarias=ventas_diarias,
    )


# ── Inventario ─────────────────────────────────────────────────────────

@router.get(
    "/inventario",
    response_model=InventarioResumen,
    summary="Resumen de inventario",
    dependencies=[Depends(require_permissions("reportes.leer"))],
)
def reporte_inventario(
    db: Session = Depends(get_db),
) -> InventarioResumen:
    stock_expr = func.sum(StockMovimiento.cantidad)

    stock_rows = db.execute(
        select(
            Variante.sku,
            Variante.precio,
            stock_expr.label("stock"),
        )
        .join(Variante, StockMovimiento.variante_id == Variante.id)
        .group_by(Variante.sku, Variante.precio)
    ).all()

    total_skus = len(stock_rows)
    skus_con_stock = sum(1 for r in stock_rows if r.stock and r.stock > 0)
    skus_sin_stock = total_skus - skus_con_stock

    stock_bajo = sorted(
        [
            {"sku": r.sku, "disponible": int(r.stock) if r.stock else 0}
            for r in stock_rows
            if r.stock is None or r.stock <= 5
        ],
        key=lambda x: x["disponible"],
    )[:20]

    valor_inventario = Decimal("0")
    for r in stock_rows:
        if r.stock and r.stock > 0:
            valor_inventario += r.precio * r.stock

    hace_7_dias = date.today() - timedelta(days=7)
    movimientos_recientes = db.scalar(
        select(func.count()).select_from(StockMovimiento).where(
            func.date(StockMovimiento.created_at) >= hace_7_dias,
        )
    ) or 0

    return InventarioResumen(
        total_skus=total_skus,
        skus_con_stock=skus_con_stock,
        skus_sin_stock=skus_sin_stock,
        valor_inventario=valor_inventario,
        movimientos_recientes=movimientos_recientes,
        stock_bajo=stock_bajo,
    )
