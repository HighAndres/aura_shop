"""Modelo de Usuario.

Soporta varios métodos de autenticación (se construyen en la etapa de auth):
contraseña (hashed_password), Google OAuth y enlace mágico. Por eso
hashed_password es opcional: un usuario solo-OAuth no tiene contraseña local.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, OdooSyncMixin, TimestampMixin, UUIDPKMixin
from app.models.rbac import usuario_roles

if TYPE_CHECKING:
    from app.models.rbac import Rol


class Usuario(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    __tablename__ = "usuarios"

    email: Mapped[str] = mapped_column(
        String(320), unique=True, index=True, nullable=False
    )
    # Opcional: nulo para usuarios que solo entran por OAuth / enlace mágico.
    hashed_password: Mapped[str | None] = mapped_column(String(255))

    nombre_completo: Mapped[str | None] = mapped_column(String(255))
    telefono: Mapped[str | None] = mapped_column(String(32))

    # RFC (México). 13 para persona física, 12 para moral.
    # Nullable en la base porque los clientes de la tienda no lo dan: la
    # obligatoriedad aplica al alta de vendedor y se valida en esa capa.
    rfc: Mapped[str | None] = mapped_column(String(13), index=True)

    # Dirección del vendedor. La captura él mismo desde su perfil y puede
    # actualizarla si se muda; no se copia al pedido, que lleva la del cliente.
    direccion_calle: Mapped[str | None] = mapped_column(String(255))
    direccion_ciudad: Mapped[str | None] = mapped_column(String(120))
    direccion_estado: Mapped[str | None] = mapped_column(String(120))
    direccion_cp: Mapped[str | None] = mapped_column(String(10))

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    # ¿Correo verificado? Necesario antes de operar según el método de registro.
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    roles: Mapped[list["Rol"]] = relationship(
        secondary=usuario_roles, back_populates="usuarios", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Usuario {self.email}>"
