"""Escritura del catálogo (admin): productos, variantes, marcas, categorías."""

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.text import slugify
from app.models.catalog import (
    Categoria,
    Marca,
    Producto,
    ValorAtributo,
    Variante,
)
from app.schemas.admin import (
    CategoriaCreate,
    MarcaCreate,
    ProductoAdminRead,
    ProductoCreate,
    ProductoUpdate,
    VarianteCreate,
    VarianteUpdate,
)


class DuplicadoError(Exception):
    """Violación de unicidad (p. ej. SKU repetido)."""


def _unique_slug(db: Session, model, base: str, propuesto: str | None = None) -> str:
    raw = slugify(propuesto) if propuesto else slugify(base)
    candidate, i = raw, 2
    while db.scalar(select(model).where(model.slug == candidate)):
        candidate = f"{raw}-{i}"
        i += 1
    return candidate


# --- Productos ---

def get_producto(db: Session, producto_id: uuid.UUID) -> Producto | None:
    return db.get(Producto, producto_id)


def list_productos_admin(
    db: Session, *, q: str | None = None, limit: int = 50, offset: int = 0
) -> tuple[list[Producto], int]:
    stmt: Select = select(Producto)
    if q:
        stmt = stmt.where(Producto.nombre.ilike(f"%{q}%"))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = list(
        db.scalars(stmt.order_by(Producto.nombre).limit(limit).offset(offset)).all()
    )
    return items, total or 0


def create_producto(db: Session, data: ProductoCreate) -> Producto:
    producto = Producto(
        nombre=data.nombre,
        slug=_unique_slug(db, Producto, data.nombre, data.slug),
        descripcion=data.descripcion,
        descripcion_corta=data.descripcion_corta,
        marca_id=data.marca_id,
        categoria_id=data.categoria_id,
        destacado=data.destacado,
        activo=data.activo,
    )
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return producto


def update_producto(
    db: Session, producto: Producto, data: ProductoUpdate
) -> tuple[Producto, dict[str, Any]]:
    cambios: dict[str, Any] = {}
    for campo, nuevo in data.model_dump(exclude_unset=True).items():
        anterior = getattr(producto, campo)
        if anterior != nuevo:
            cambios[campo] = {"antes": _jsonable(anterior), "despues": _jsonable(nuevo)}
            setattr(producto, campo, nuevo)
    db.commit()
    db.refresh(producto)
    return producto, cambios


def deactivate_producto(db: Session, producto: Producto) -> Producto:
    producto.activo = False
    db.commit()
    db.refresh(producto)
    return producto


# --- Variantes ---

def get_variante(db: Session, variante_id: uuid.UUID) -> Variante | None:
    return db.get(Variante, variante_id)


def create_variante(db: Session, producto: Producto, data: VarianteCreate) -> Variante:
    if db.scalar(select(Variante).where(Variante.sku == data.sku)):
        raise DuplicadoError(f"El SKU '{data.sku}' ya existe")
    variante = Variante(
        producto_id=producto.id,
        sku=data.sku,
        nombre=data.nombre,
        precio=data.precio,
        precio_comparativo=data.precio_comparativo,
        codigo_barras=data.codigo_barras,
        peso_gramos=data.peso_gramos,
        activo=data.activo,
    )
    if data.valores:
        variante.valores = list(
            db.scalars(
                select(ValorAtributo).where(ValorAtributo.id.in_(data.valores))
            ).all()
        )
    db.add(variante)
    db.commit()
    db.refresh(variante)
    return variante


def update_variante(
    db: Session, variante: Variante, data: VarianteUpdate
) -> tuple[Variante, dict[str, Any]]:
    cambios: dict[str, Any] = {}
    for campo, nuevo in data.model_dump(exclude_unset=True).items():
        anterior = getattr(variante, campo)
        if anterior != nuevo:
            cambios[campo] = {"antes": _jsonable(anterior), "despues": _jsonable(nuevo)}
            setattr(variante, campo, nuevo)
    db.commit()
    db.refresh(variante)
    return variante, cambios


# --- Marcas / Categorías ---

def create_marca(db: Session, data: MarcaCreate) -> Marca:
    marca = Marca(
        nombre=data.nombre,
        slug=_unique_slug(db, Marca, data.nombre, data.slug),
        descripcion=data.descripcion,
        logo_url=data.logo_url,
        activo=data.activo,
    )
    db.add(marca)
    db.commit()
    db.refresh(marca)
    return marca


def create_categoria(db: Session, data: CategoriaCreate) -> Categoria:
    categoria = Categoria(
        nombre=data.nombre,
        slug=_unique_slug(db, Categoria, data.nombre, data.slug),
        descripcion=data.descripcion,
        parent_id=data.parent_id,
        orden=data.orden,
        activo=data.activo,
    )
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria


# --- Serialización ---

def _jsonable(v: Any) -> Any:
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, uuid.UUID):
        return str(v)
    return v


def serialize_admin_item(p: Producto) -> ProductoAdminRead:
    precios = [v.precio for v in p.variantes]
    return ProductoAdminRead(
        id=p.id,
        nombre=p.nombre,
        slug=p.slug,
        activo=p.activo,
        destacado=p.destacado,
        marca=p.marca.nombre if p.marca else None,
        categoria=p.categoria.nombre if p.categoria else None,
        num_variantes=len(p.variantes),
        precio_min=min(precios) if precios else None,
    )
