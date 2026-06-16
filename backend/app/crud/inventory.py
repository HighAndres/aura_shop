"""Lógica del inventario ledger: movimientos y cálculo de stock disponible."""

import uuid
from datetime import date

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.catalog import Producto, Variante
from app.models.inventory import Almacen, Lote, StockMovimiento, TipoMovimiento


class StockInsuficienteError(Exception):
    """El movimiento dejaría el stock por debajo de cero."""


# --- Lecturas auxiliares ---

def get_almacen_by_codigo(db: Session, codigo: str) -> Almacen | None:
    return db.scalar(select(Almacen).where(Almacen.codigo == codigo))


def list_almacenes(db: Session) -> list[Almacen]:
    return list(
        db.scalars(
            select(Almacen).where(Almacen.activo.is_(True)).order_by(Almacen.nombre)
        ).all()
    )


def get_variante_by_sku(db: Session, sku: str) -> Variante | None:
    return db.scalar(select(Variante).where(Variante.sku == sku))


def get_or_create_lote(
    db: Session, variante_id: uuid.UUID, codigo: str, caducidad: date | None
) -> Lote:
    lote = db.scalar(
        select(Lote).where(Lote.variante_id == variante_id, Lote.codigo == codigo)
    )
    if lote is None:
        lote = Lote(variante_id=variante_id, codigo=codigo, fecha_caducidad=caducidad)
        db.add(lote)
        db.flush()
    elif caducidad is not None and lote.fecha_caducidad != caducidad:
        lote.fecha_caducidad = caducidad
    return lote


# --- Cálculo de stock (SUMA del ledger) ---

def disponible(
    db: Session,
    variante_id: uuid.UUID,
    almacen_id: uuid.UUID | None = None,
    lote_id: uuid.UUID | None = None,
) -> int:
    stmt = select(func.coalesce(func.sum(StockMovimiento.cantidad), 0)).where(
        StockMovimiento.variante_id == variante_id
    )
    if almacen_id is not None:
        stmt = stmt.where(StockMovimiento.almacen_id == almacen_id)
    if lote_id is not None:
        stmt = stmt.where(StockMovimiento.lote_id == lote_id)
    return int(db.scalar(stmt) or 0)


def disponible_por_variantes(
    db: Session, variante_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """Stock total por variante (todos los almacenes), en una sola consulta."""
    if not variante_ids:
        return {}
    rows = db.execute(
        select(
            StockMovimiento.variante_id,
            func.coalesce(func.sum(StockMovimiento.cantidad), 0),
        )
        .where(StockMovimiento.variante_id.in_(variante_ids))
        .group_by(StockMovimiento.variante_id)
    ).all()
    return {vid: int(total) for vid, total in rows}


# --- Registro de movimientos (append-only) ---

def registrar_movimiento(
    db: Session,
    *,
    variante: Variante,
    almacen: Almacen,
    tipo: TipoMovimiento,
    cantidad: int,
    lote: Lote | None = None,
    referencia: str | None = None,
    nota: str | None = None,
) -> StockMovimiento:
    """Crea un movimiento. Rechaza si dejaría el stock negativo."""
    lote_id = lote.id if lote else None
    actual = disponible(db, variante.id, almacen.id, lote_id)
    if actual + cantidad < 0:
        raise StockInsuficienteError(
            f"Stock insuficiente para {variante.sku} en {almacen.codigo}: "
            f"disponible {actual}, se intentó {cantidad}."
        )

    mov = StockMovimiento(
        variante_id=variante.id,
        almacen_id=almacen.id,
        lote_id=lote_id,
        tipo=tipo.value,
        cantidad=cantidad,
        referencia=referencia,
        nota=nota,
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return mov


# --- Listados ---

def list_movimientos(
    db: Session,
    *,
    sku: str | None = None,
    almacen: str | None = None,
    tipo: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[StockMovimiento]:
    stmt: Select = select(StockMovimiento).join(StockMovimiento.variante)
    if sku:
        stmt = stmt.where(Variante.sku == sku)
    if almacen:
        stmt = stmt.join(StockMovimiento.almacen).where(Almacen.codigo == almacen)
    if tipo:
        stmt = stmt.where(StockMovimiento.tipo == tipo)
    stmt = stmt.order_by(StockMovimiento.fecha.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt).all())


def stock_actual(
    db: Session, *, sku: str | None = None, almacen: str | None = None
) -> list[tuple[str, str, str, int]]:
    """Devuelve (sku, nombre_producto, codigo_almacen, disponible) agregado."""
    stmt = (
        select(
            Variante.sku,
            Producto.nombre,
            Almacen.codigo,
            func.coalesce(func.sum(StockMovimiento.cantidad), 0),
        )
        .join(Variante, StockMovimiento.variante_id == Variante.id)
        .join(Producto, Variante.producto_id == Producto.id)
        .join(Almacen, StockMovimiento.almacen_id == Almacen.id)
        .group_by(Variante.sku, Producto.nombre, Almacen.codigo)
        .order_by(Variante.sku)
    )
    if sku:
        stmt = stmt.where(Variante.sku == sku)
    if almacen:
        stmt = stmt.where(Almacen.codigo == almacen)
    return [(s, p, a, int(d)) for s, p, a, d in db.execute(stmt).all()]
