"""Modelos de pedido.

El pedido congela precios y datos al momento del checkout. Incluye datos
fiscales CFDI (México) opcionales que luego se mapean al res.partner de Odoo.
Se empuja hacia Odoo (de ahí OdooSyncMixin).
"""

from __future__ import annotations

import enum
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, OdooSyncMixin, TimestampMixin, UUIDPKMixin


class EstadoPedido(str, enum.Enum):
    PENDIENTE = "pendiente"
    PAGADO = "pagado"
    ENVIADO = "enviado"
    ENTREGADO = "entregado"
    CANCELADO = "cancelado"


class Pedido(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    __tablename__ = "pedidos"

    numero: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=False
    )
    # Nulo para checkout de invitado; el correo siempre se guarda.
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    estado: Mapped[str] = mapped_column(
        String(20), default="pendiente", server_default="pendiente", nullable=False
    )

    # Contacto y envío
    nombre_contacto: Mapped[str] = mapped_column(String(255), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(32))
    direccion_calle: Mapped[str | None] = mapped_column(String(255))
    direccion_ciudad: Mapped[str | None] = mapped_column(String(120))
    direccion_estado: Mapped[str | None] = mapped_column(String(120))
    direccion_cp: Mapped[str | None] = mapped_column(String(10))
    direccion_pais: Mapped[str] = mapped_column(
        String(2), default="MX", server_default="MX", nullable=False
    )
    notas: Mapped[str | None] = mapped_column(Text)

    # Datos fiscales CFDI (opcionales)
    requiere_factura: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    rfc: Mapped[str | None] = mapped_column(String(13))
    razon_social: Mapped[str | None] = mapped_column(String(255))
    regimen_fiscal: Mapped[str | None] = mapped_column(String(10))
    uso_cfdi: Mapped[str | None] = mapped_column(String(10))
    cp_fiscal: Mapped[str | None] = mapped_column(String(10))

    # Totales (MXN)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    envio: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=0, server_default="0", nullable=False
    )
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    items: Mapped[list[PedidoItem]] = relationship(
        back_populates="pedido",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Pedido {self.numero} ({self.estado})>"


class PedidoItem(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "pedido_items"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_pedido_item_cantidad"),
    )

    pedido_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pedidos.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # SET NULL: si la variante se elimina, el histórico del pedido se conserva.
    variante_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("variantes.id", ondelete="SET NULL"), index=True
    )
    # Snapshots al momento de la compra (no cambian si el catálogo cambia).
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    cantidad: Mapped[int] = mapped_column(nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    pedido: Mapped[Pedido] = relationship(back_populates="items")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PedidoItem {self.sku} x{self.cantidad}>"
