import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base declarativa para todos los modelos ORM (SQLAlchemy 2.0)."""


class UUIDPKMixin:
    """Llave primaria UUID v4 (no adivinable, segura para URLs públicas)."""

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    """Columnas de auditoría reutilizables: creado/actualizado."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class OdooSyncMixin:
    """Campos puente para sincronización con Odoo (la integración real va aparte).

    - external_id: id del registro correspondiente en Odoo (p. ej. res.partner).
    - sync_status: estado de sincronización (pending / synced / error).
    - last_synced_at: última vez que se empujó/jaló desde Odoo.
    """

    external_id: Mapped[str | None] = mapped_column(String(64), index=True)
    sync_status: Mapped[str] = mapped_column(
        String(16), default="pending", server_default="pending", nullable=False
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
