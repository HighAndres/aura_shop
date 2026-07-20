"""Modelos de carrito.

Soporta carrito de invitado (identificado por `token`) y de usuario
(`usuario_id`). Al iniciar sesión, el carrito de invitado se fusiona en el
del usuario. El precio se lee en vivo de la variante; al hacer checkout se
congela en el pedido.
"""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Carrito(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "carritos"

    # Uno de los dos identifica al dueño: usuario (logueado) o token (invitado).
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    token: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    # activo | convertido | abandonado
    estado: Mapped[str] = mapped_column(
        String(20), default="activo", server_default="activo", nullable=False
    )

    items: Mapped[list[CarritoItem]] = relationship(
        back_populates="carrito",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    paquetes: Mapped[list[CarritoPaquete]] = relationship(
        back_populates="carrito",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Carrito {self.id} ({self.estado})>"


class CarritoItem(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "carrito_items"
    __table_args__ = (
        UniqueConstraint("carrito_id", "variante_id", name="uq_carrito_variante"),
        CheckConstraint("cantidad > 0", name="ck_carrito_item_cantidad"),
    )

    carrito_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("carritos.id", ondelete="CASCADE"), index=True, nullable=False
    )
    variante_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("variantes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cantidad: Mapped[int] = mapped_column(nullable=False)

    carrito: Mapped[Carrito] = relationship(back_populates="items")
    variante = relationship("Variante", lazy="selectin")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CarritoItem {self.variante_id} x{self.cantidad}>"


class CarritoPaquete(UUIDPKMixin, TimestampMixin, Base):
    """Línea de paquete en el carrito.

    Va aparte de los items sueltos porque su precio es el del paquete, no la
    suma de sus componentes; al hacer checkout se expande a sus variantes
    para descontar inventario.
    """

    __tablename__ = "carrito_paquetes"
    __table_args__ = (
        UniqueConstraint("carrito_id", "paquete_id", name="uq_carrito_paquete"),
        CheckConstraint("cantidad > 0", name="ck_carrito_paquete_cantidad"),
    )

    carrito_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("carritos.id", ondelete="CASCADE"), index=True, nullable=False
    )
    paquete_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("paquetes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cantidad: Mapped[int] = mapped_column(nullable=False)

    carrito: Mapped[Carrito] = relationship(back_populates="paquetes")
    paquete = relationship("Paquete", lazy="selectin")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CarritoPaquete {self.paquete_id} x{self.cantidad}>"
