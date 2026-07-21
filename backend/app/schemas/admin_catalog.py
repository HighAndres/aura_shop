"""Schemas para endpoints administrativos del catálogo."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# --- Marcas ---

class MarcaCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=140)
    descripcion: str | None = None
    logo_url: str | None = Field(default=None, max_length=500)


class MarcaUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    descripcion: str | None = None
    logo_url: str | None = Field(default=None, max_length=500)
    activo: bool | None = None


class MarcaAdminRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    slug: str
    descripcion: str | None = None
    logo_url: str | None = None
    activo: bool


# --- Categorías ---

class CategoriaCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=140)
    descripcion: str | None = None
    parent_id: uuid.UUID | None = None
    orden: int = 0


class CategoriaUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    descripcion: str | None = None
    parent_id: uuid.UUID | None = None
    orden: int | None = None
    activo: bool | None = None


class CategoriaAdminRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    slug: str
    descripcion: str | None = None
    parent_id: uuid.UUID | None = None
    orden: int
    activo: bool


# --- Variantes ---

class VarianteIn(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    nombre: str | None = Field(default=None, max_length=255)
    precio: Decimal = Field(ge=0)
    precio_comparativo: Decimal | None = None
    costo: Decimal | None = Field(default=None, ge=0)
    activo: bool = True


class VarianteAdminRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    nombre: str | None = None
    precio: Decimal
    precio_comparativo: Decimal | None = None
    # Se anula en la respuesta si quien consulta no tiene "productos.ver_costo".
    costo: Decimal | None = None
    activo: bool


# --- Imágenes ---

class ImagenIn(BaseModel):
    url: str = Field(max_length=500)
    alt: str | None = Field(default=None, max_length=255)
    orden: int = 0
    es_principal: bool = False


class ImagenAdminRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    alt: str | None = None
    orden: int
    es_principal: bool


# --- Productos ---

class ProductoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=280)
    descripcion: str | None = None
    descripcion_corta: str | None = Field(default=None, max_length=500)
    marca_id: uuid.UUID | None = None
    categoria_id: uuid.UUID | None = None
    destacado: bool = False
    variantes: list[VarianteIn] = Field(min_length=1)
    imagenes: list[ImagenIn] = []


class ProductoUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=255)
    slug: str | None = Field(default=None, max_length=280)
    descripcion: str | None = None
    descripcion_corta: str | None = Field(default=None, max_length=500)
    marca_id: uuid.UUID | None = None
    categoria_id: uuid.UUID | None = None
    destacado: bool | None = None
    variantes: list[VarianteIn] | None = None
    imagenes: list[ImagenIn] | None = None


class ProductoAdminRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    slug: str
    descripcion: str | None = None
    descripcion_corta: str | None = None
    marca_id: uuid.UUID | None = None
    categoria_id: uuid.UUID | None = None
    activo: bool
    destacado: bool
    variantes: list[VarianteAdminRead] = []
    imagenes: list[ImagenAdminRead] = []
    created_at: datetime | None = None


class ProductoAdminPage(BaseModel):
    items: list[ProductoAdminRead]
    total: int
    limit: int
    offset: int
