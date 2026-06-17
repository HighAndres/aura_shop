"""Schemas para la administración del catálogo (escritura)."""

import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# --- Productos ---

class ProductoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=280)
    descripcion: str | None = None
    descripcion_corta: str | None = Field(default=None, max_length=500)
    marca_id: uuid.UUID | None = None
    categoria_id: uuid.UUID | None = None
    destacado: bool = False
    activo: bool = True


class ProductoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=255)
    descripcion: str | None = None
    descripcion_corta: str | None = Field(default=None, max_length=500)
    marca_id: uuid.UUID | None = None
    categoria_id: uuid.UUID | None = None
    destacado: bool | None = None
    activo: bool | None = None


class ProductoAdminRead(BaseModel):
    id: uuid.UUID
    nombre: str
    slug: str
    activo: bool
    destacado: bool
    marca: str | None = None
    categoria: str | None = None
    num_variantes: int = 0
    precio_min: Decimal | None = None


# --- Variantes ---

class VarianteCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    nombre: str | None = Field(default=None, max_length=255)
    precio: Decimal = Field(ge=0)
    precio_comparativo: Decimal | None = Field(default=None, ge=0)
    codigo_barras: str | None = Field(default=None, max_length=64)
    peso_gramos: int | None = Field(default=None, ge=0)
    activo: bool = True
    # Valores de atributo existentes a asociar (Tono/Tamaño/...).
    valores: list[uuid.UUID] = []


class VarianteUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=255)
    precio: Decimal | None = Field(default=None, ge=0)
    precio_comparativo: Decimal | None = Field(default=None, ge=0)
    codigo_barras: str | None = Field(default=None, max_length=64)
    peso_gramos: int | None = Field(default=None, ge=0)
    activo: bool | None = None


class VarianteAdminRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    nombre: str | None
    precio: Decimal
    precio_comparativo: Decimal | None
    activo: bool


# --- Marcas / Categorías ---

class MarcaCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    descripcion: str | None = None
    logo_url: str | None = Field(default=None, max_length=500)
    activo: bool = True


class CategoriaCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    descripcion: str | None = None
    parent_id: uuid.UUID | None = None
    orden: int = 0
    activo: bool = True
