import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """Datos para registrar un usuario con email + contraseña."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    nombre_completo: str | None = Field(default=None, max_length=255)
    telefono: str | None = Field(default=None, max_length=32)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    """Representación pública de un usuario (sin contraseña)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    nombre_completo: str | None
    telefono: str | None
    is_active: bool
    is_verified: bool
    roles: list[str] = []
    created_at: datetime

    @field_validator("roles", mode="before")
    @classmethod
    def _roles_a_nombres(cls, v: object) -> list[str]:
        """Convierte objetos Rol del ORM en una lista de nombres."""
        if isinstance(v, list):
            return [r if isinstance(r, str) else r.nombre for r in v]
        return v
