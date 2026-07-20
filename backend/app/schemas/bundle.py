"""Schemas para paquetes (bundles)."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PaqueteItemIn(BaseModel):
    producto_id: uuid.UUID
    variante_id: uuid.UUID | None = None
    cantidad: int = Field(default=1, ge=1)
    orden: int = 0


class PaqueteItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    producto_id: uuid.UUID
    variante_id: uuid.UUID | None = None
    cantidad: int
    orden: int
    producto_nombre: str | None = None
    variante_sku: str | None = None
    precio_unitario: Decimal | None = None


class PaqueteCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=280)
    descripcion: str | None = None
    descripcion_corta: str | None = Field(default=None, max_length=500)
    imagen_url: str | None = Field(default=None, max_length=500)
    precio_paquete: Decimal = Field(ge=0)
    destacado: bool = False
    items: list[PaqueteItemIn] = Field(min_length=1)


class PaqueteUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=255)
    slug: str | None = Field(default=None, max_length=280)
    descripcion: str | None = None
    descripcion_corta: str | None = Field(default=None, max_length=500)
    imagen_url: str | None = Field(default=None, max_length=500)
    precio_paquete: Decimal | None = Field(default=None, ge=0)
    destacado: bool | None = None
    items: list[PaqueteItemIn] | None = None


class PaqueteItemPublic(BaseModel):
    """Contenido de un paquete tal como lo ve la tienda."""

    producto_nombre: str
    producto_slug: str | None = None
    variante_sku: str | None = None
    cantidad: int


class PaquetePublic(BaseModel):
    """Paquete visible en la tienda (solo activos)."""

    id: uuid.UUID
    nombre: str
    slug: str
    descripcion: str | None = None
    descripcion_corta: str | None = None
    imagen_url: str | None = None
    precio_paquete: Decimal
    precio_individual: Decimal
    ahorro: Decimal
    destacado: bool
    items: list[PaqueteItemPublic] = []


class PaquetesPublicPage(BaseModel):
    items: list[PaquetePublic]
    total: int
    limit: int
    offset: int


class PaqueteAdminRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    slug: str
    descripcion: str | None = None
    descripcion_corta: str | None = None
    imagen_url: str | None = None
    precio_paquete: Decimal
    precio_individual: Decimal
    ahorro: Decimal
    activo: bool
    destacado: bool
    items: list[PaqueteItemRead] = []
    created_at: datetime | None = None


class PaqueteAdminPage(BaseModel):
    items: list[PaqueteAdminRead]
    total: int
    limit: int
    offset: int
