"""Modelos de pedido.

El pedido congela precios y datos al momento del checkout. Incluye datos
fiscales CFDI (México) opcionales que luego se mapean al res.partner de Odoo.
Se empuja hacia Odoo (de ahí OdooSyncMixin).
"""

from __future__ import annotations

import enum
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

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

if TYPE_CHECKING:
    from app.models.user import Usuario


class EstadoPedido(str, enum.Enum):
    PENDIENTE = "pendiente"
    PAGADO = "pagado"
    ENVIADO = "enviado"
    ENTREGADO = "entregado"
    CANCELADO = "cancelado"


class OrigenTransicion(str, enum.Enum):
    """Qué provocó un cambio de estado.

    Distinguir el origen es lo que permite auditar que "pagado" llegó por un
    cobro real y no porque alguien apretó un botón.
    """

    USUARIO = "usuario"    # una persona desde el panel
    PASARELA = "pasarela"  # webhook de la pasarela de pagos
    SISTEMA = "sistema"    # proceso interno (expiraciones, sincronizaciones)


class Pedido(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    __tablename__ = "pedidos"

    numero: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=False
    )
    # Nulo para checkout de invitado; el correo siempre se guarda.
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), index=True
    )
    asignado_a: Mapped[uuid.UUID | None] = mapped_column(
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
    historial: Mapped[list[PedidoEstadoHistorial]] = relationship(
        back_populates="pedido",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="PedidoEstadoHistorial.created_at",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Pedido {self.numero} ({self.estado})>"


class PedidoEstadoHistorial(UUIDPKMixin, TimestampMixin, Base):
    """Rastro de cada cambio de estado de un pedido.

    La bitácora general solo registra acciones de personas; esto también
    guarda las de la pasarela y el sistema, y es la fuente para reconstruir
    cuándo se pagó o se envió un pedido.
    """

    __tablename__ = "pedido_estado_historial"

    pedido_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pedidos.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Nulo en el asiento de creación del pedido.
    estado_anterior: Mapped[str | None] = mapped_column(String(20))
    estado_nuevo: Mapped[str] = mapped_column(String(20), nullable=False)
    origen: Mapped[str] = mapped_column(String(20), nullable=False)
    # Nulo cuando el origen no es una persona (pasarela, sistema).
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), index=True
    )
    nota: Mapped[str | None] = mapped_column(Text)
    # Referencia externa: id de transacción de la pasarela, guía de envío, etc.
    referencia: Mapped[str | None] = mapped_column(String(120))

    pedido: Mapped[Pedido] = relationship(back_populates="historial")
    # selectin y no lazy por defecto: al serializar la línea de tiempo se
    # necesita el nombre de cada actor, y una consulta por asiento sería N+1.
    actor: Mapped["Usuario | None"] = relationship(lazy="selectin")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PedidoEstadoHistorial {self.estado_anterior}->{self.estado_nuevo}>"


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
