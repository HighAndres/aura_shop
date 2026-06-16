"""Modelos de control de acceso por roles (RBAC) con permisos granulares.

Estructura:
    usuarios ──< usuario_roles >── roles ──< rol_permisos >── permisos

Roles base del sistema: superadmin, staff, cliente, invitado.
Los permisos usan códigos tipo "recurso.accion" (p. ej. "usuarios.leer").
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.user import Usuario


# --- Tablas de asociación (many-to-many) ---

usuario_roles = Table(
    "usuario_roles",
    Base.metadata,
    Column(
        "usuario_id",
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "rol_id",
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

rol_permisos = Table(
    "rol_permisos",
    Base.metadata,
    Column(
        "rol_id",
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permiso_id",
        ForeignKey("permisos.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Rol(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    nombre: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    descripcion: Mapped[str | None] = mapped_column(String(255))
    # Roles base creados por seed; no deben eliminarse desde la UI.
    es_sistema: Mapped[bool] = mapped_column(default=False, nullable=False)

    permisos: Mapped[list[Permiso]] = relationship(
        secondary=rol_permisos, back_populates="roles", lazy="selectin"
    )
    usuarios: Mapped[list["Usuario"]] = relationship(
        secondary=usuario_roles, back_populates="roles"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Rol {self.nombre}>"


class Permiso(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "permisos"

    # Código estable "recurso.accion", p. ej. "pedidos.crear".
    codigo: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    descripcion: Mapped[str | None] = mapped_column(String(255))

    roles: Mapped[list[Rol]] = relationship(
        secondary=rol_permisos, back_populates="permisos"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Permiso {self.codigo}>"
