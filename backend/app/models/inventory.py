"""Modelos de inventario tipo ledger.

El stock NO se guarda como un número: es la SUMA de movimientos
(`stock_movimientos.cantidad`, con signo). Los movimientos son inmutables
(append-only). El stock se lleva por almacén y, opcionalmente, por lote.

    disponible(variante, almacén) = SUM(cantidad de stock_movimientos)
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, OdooSyncMixin, TimestampMixin, UUIDPKMixin


class TipoMovimiento(str, enum.Enum):
    """Categoría del movimiento de inventario."""

    ENTRADA = "entrada"   # recepción / compra (cantidad > 0)
    SALIDA = "salida"     # venta / merma / envío (cantidad < 0)
    AJUSTE = "ajuste"     # corrección de inventario (cantidad ≠ 0, cualquier signo)


class Almacen(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    __tablename__ = "almacenes"

    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    codigo: Mapped[str] = mapped_column(
        String(40), unique=True, index=True, nullable=False
    )
    activo: Mapped[bool] = mapped_column(default=True, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Almacen {self.codigo}>"


class Lote(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    """Lote de una variante, con fecha de caducidad opcional."""

    __tablename__ = "lotes"
    __table_args__ = (
        UniqueConstraint("variante_id", "codigo", name="uq_lote_variante_codigo"),
    )

    variante_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("variantes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    codigo: Mapped[str] = mapped_column(String(64), nullable=False)
    fecha_caducidad: Mapped[date | None] = mapped_column(Date, index=True)

    variante = relationship("Variante")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Lote {self.codigo}>"


class StockMovimiento(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    """Asiento del ledger de inventario (inmutable).

    `cantidad` con signo: positiva aumenta stock, negativa lo reduce.
    """

    __tablename__ = "stock_movimientos"
    __table_args__ = (
        CheckConstraint("cantidad <> 0", name="ck_movimiento_cantidad_no_cero"),
    )

    variante_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("variantes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    almacen_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("almacenes.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    lote_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("lotes.id", ondelete="SET NULL"), index=True
    )

    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    referencia: Mapped[str | None] = mapped_column(String(120))
    nota: Mapped[str | None] = mapped_column(String(255))
    # Fecha efectiva del movimiento (puede diferir de created_at).
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    variante = relationship("Variante")
    almacen = relationship("Almacen")
    lote = relationship("Lote")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<StockMovimiento {self.tipo} {self.cantidad}>"
