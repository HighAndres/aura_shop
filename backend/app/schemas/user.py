import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.rfc import validar_rfc


class UserCreate(BaseModel):
    """Datos para registrar un usuario con email + contraseña."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    nombre_completo: str | None = Field(default=None, max_length=255)
    telefono: str | None = Field(default=None, max_length=32)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublicRead(BaseModel):
    """Lo que ve un cliente normal — sin roles ni info interna."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    nombre_completo: str | None
    telefono: str | None
    is_active: bool
    is_verified: bool
    created_at: datetime


class UserProfileUpdate(BaseModel):
    """Lo que un usuario puede cambiar de su propio perfil.

    Deliberadamente NO incluye email, roles, is_active ni is_verified: eso
    sería escalar privilegios contra uno mismo.
    """

    nombre_completo: str | None = Field(default=None, max_length=255)
    telefono: str | None = Field(default=None, max_length=32)
    rfc: str | None = Field(default=None, max_length=13)
    direccion_calle: str | None = Field(default=None, max_length=255)
    direccion_ciudad: str | None = Field(default=None, max_length=120)
    direccion_estado: str | None = Field(default=None, max_length=120)
    direccion_cp: str | None = Field(default=None, max_length=10)

    # mode="before" para normalizar ANTES de que aplique max_length: escrito
    # con guiones ("GODE-561231-GR8") son 15 caracteres y se rechazaría sin
    # llegar nunca a quitarlos.
    @field_validator("rfc", mode="before")
    @classmethod
    def _validar_rfc(cls, v: object) -> str | None:
        # Cadena vacía = "lo dejo en blanco", no un RFC malformado.
        if v is None or not str(v).strip():
            return None
        return validar_rfc(str(v))


class UserRead(BaseModel):
    """Representación completa (solo para endpoints admin)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    nombre_completo: str | None
    telefono: str | None
    rfc: str | None = None
    direccion_calle: str | None = None
    direccion_ciudad: str | None = None
    direccion_estado: str | None = None
    direccion_cp: str | None = None
    is_active: bool
    is_verified: bool
    roles: list[str] = []
    created_at: datetime

    @field_validator("roles", mode="before")
    @classmethod
    def _roles_a_nombres(cls, v: object) -> list[str]:
        if isinstance(v, list):
            return [r if isinstance(r, str) else r.nombre for r in v]
        return v


class UserMeRead(UserRead):
    """Perfil propio. Añade los permisos efectivos para que el frontend
    muestre menús y botones con la misma fuente de verdad que usa la API.

    Es solo para /users/me: el listado de usuarios no los incluye.
    """

    permisos: list[str] = []
