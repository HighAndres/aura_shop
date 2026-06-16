"""Bitácora de auditoría (audit log).

Registra acciones de escritura del personal (vendedor/administrador/superadmin):
quién, qué acción, sobre qué entidad, con qué cambios, desde qué IP y cuándo.
Append-only; solo el superadmin la consulta (permiso bitacora.leer).
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Auditoria(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "auditoria"

    # Actor. SET NULL: si se borra el usuario, el registro se conserva.
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), index=True
    )
    # Snapshots para que el registro sea legible aunque cambie/borre el usuario.
    actor_email: Mapped[str | None] = mapped_column(String(320))
    actor_rol: Mapped[str | None] = mapped_column(String(120))

    # Acción "recurso.accion" (p. ej. "inventario.ajustar", "producto.editar").
    accion: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    entidad: Mapped[str | None] = mapped_column(String(64), index=True)
    entidad_id: Mapped[str | None] = mapped_column(String(64))
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    # Detalle estructurado (antes/después, payload, etc.).
    cambios: Mapped[dict | None] = mapped_column(JSONB)

    ip: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Auditoria {self.accion} por {self.actor_email}>"
