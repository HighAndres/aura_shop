"""Modelos de paquetes: agrupaciones de productos con precio especial."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Paquete(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "paquetes"

    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(280), unique=True, index=True, nullable=False
    )
    descripcion: Mapped[str | None] = mapped_column(Text)
    descripcion_corta: Mapped[str | None] = mapped_column(String(500))
    imagen_url: Mapped[str | None] = mapped_column(String(500))
    precio_paquete: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    destacado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    items: Mapped[list[PaqueteItem]] = relationship(
        back_populates="paquete",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="PaqueteItem.orden",
    )

    def __repr__(self) -> str:
        return f"<Paquete {self.nombre}>"


class PaqueteItem(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "paquete_items"

    paquete_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("paquetes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    producto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    variante_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("variantes.id", ondelete="SET NULL"),
        index=True,
    )
    cantidad: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    paquete: Mapped[Paquete] = relationship(back_populates="items")
    producto: Mapped["Producto"] = relationship(lazy="selectin")
    variante: Mapped["Variante | None"] = relationship(lazy="selectin")
