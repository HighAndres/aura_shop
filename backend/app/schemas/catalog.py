"""Schemas de lectura del catálogo (salida pública de la tienda)."""

import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class MarcaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    slug: str
    logo_url: str | None = None


class CategoriaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    slug: str
    parent_id: uuid.UUID | None = None


class ValorAtributoRead(BaseModel):
    """Par atributo→valor de una variante, ej. {atributo: 'Tono', valor: 'Rojo'}."""

    atributo: str
    valor: str


class ImagenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    url: str
    alt: str | None = None
    es_principal: bool = False


class VarianteRead(BaseModel):
    id: uuid.UUID
    sku: str
    nombre: str | None = None
    precio: Decimal
    precio_comparativo: Decimal | None = None
    activo: bool
    atributos: list[ValorAtributoRead] = []


class ProductoListItem(BaseModel):
    """Resumen de producto para listados (tarjetas de la tienda)."""

    id: uuid.UUID
    nombre: str
    slug: str
    descripcion_corta: str | None = None
    marca: str | None = None
    destacado: bool = False
    precio_desde: Decimal | None = None
    imagen: str | None = None


class ProductoDetail(BaseModel):
    """Detalle completo de producto (página de producto)."""

    id: uuid.UUID
    nombre: str
    slug: str
    descripcion: str | None = None
    descripcion_corta: str | None = None
    destacado: bool = False
    marca: MarcaRead | None = None
    categoria: CategoriaRead | None = None
    imagenes: list[ImagenRead] = []
    variantes: list[VarianteRead] = []
    rating_promedio: float | None = None
    num_resenas: int = 0


class ProductosPage(BaseModel):
    """Resultado paginado de productos."""

    items: list[ProductoListItem]
    total: int
    limit: int
    offset: int
