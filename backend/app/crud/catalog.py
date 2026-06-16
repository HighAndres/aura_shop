"""Consultas y serialización del catálogo público."""

from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.catalog import Categoria, Marca, Producto, Variante
from app.models.review import Resena
from app.schemas.catalog import (
    CategoriaRead,
    ImagenRead,
    MarcaRead,
    ProductoDetail,
    ProductoListItem,
    ValorAtributoRead,
    VarianteRead,
)


# --- Listas simples ---

def list_marcas(db: Session) -> list[Marca]:
    return list(
        db.scalars(
            select(Marca).where(Marca.activo.is_(True)).order_by(Marca.nombre)
        ).all()
    )


def list_categorias(db: Session) -> list[Categoria]:
    return list(
        db.scalars(
            select(Categoria)
            .where(Categoria.activo.is_(True))
            .order_by(Categoria.orden, Categoria.nombre)
        ).all()
    )


# --- Productos ---

def _base_productos_query() -> Select:
    return select(Producto).where(Producto.activo.is_(True))


def list_productos(
    db: Session,
    *,
    categoria_slug: str | None = None,
    marca_slug: str | None = None,
    q: str | None = None,
    destacado: bool | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Producto], int]:
    stmt = _base_productos_query()

    if categoria_slug:
        stmt = stmt.join(Producto.categoria).where(
            Categoria.slug == categoria_slug
        )
    if marca_slug:
        stmt = stmt.join(Producto.marca).where(Marca.slug == marca_slug)
    if q:
        stmt = stmt.where(Producto.nombre.ilike(f"%{q}%"))
    if destacado is not None:
        stmt = stmt.where(Producto.destacado.is_(destacado))

    total = db.scalar(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    )
    items = list(
        db.scalars(
            stmt.order_by(Producto.nombre).limit(limit).offset(offset)
        ).all()
    )
    return items, total or 0


def get_producto_by_slug(db: Session, slug: str) -> Producto | None:
    return db.scalar(
        _base_productos_query().where(Producto.slug == slug)
    )


def rating_de_producto(db: Session, producto_id) -> tuple[float | None, int]:
    """Promedio y número de reseñas aprobadas de un producto."""
    avg, count = db.execute(
        select(func.avg(Resena.rating), func.count(Resena.id)).where(
            Resena.producto_id == producto_id, Resena.aprobada.is_(True)
        )
    ).one()
    return (round(float(avg), 2) if avg is not None else None, count)


# --- Serializadores (ORM -> schemas) ---

def _imagen_principal(p: Producto) -> str | None:
    if not p.imagenes:
        return None
    principal = next((i for i in p.imagenes if i.es_principal), None)
    return (principal or p.imagenes[0]).url


def _precio_desde(p: Producto) -> Decimal | None:
    precios = [v.precio for v in p.variantes if v.activo]
    return min(precios) if precios else None


def serialize_list_item(p: Producto) -> ProductoListItem:
    return ProductoListItem(
        id=p.id,
        nombre=p.nombre,
        slug=p.slug,
        descripcion_corta=p.descripcion_corta,
        marca=p.marca.nombre if p.marca else None,
        destacado=p.destacado,
        precio_desde=_precio_desde(p),
        imagen=_imagen_principal(p),
    )


def _serialize_variante(v: Variante, disponible: int = 0) -> VarianteRead:
    return VarianteRead(
        id=v.id,
        sku=v.sku,
        nombre=v.nombre,
        precio=v.precio,
        precio_comparativo=v.precio_comparativo,
        activo=v.activo,
        disponible=disponible,
        atributos=[
            ValorAtributoRead(atributo=val.atributo.nombre, valor=val.valor)
            for val in v.valores
        ],
    )


def serialize_detail(
    p: Producto,
    rating_promedio: float | None,
    num_resenas: int,
    stock_por_variante: dict | None = None,
) -> ProductoDetail:
    stock = stock_por_variante or {}
    return ProductoDetail(
        id=p.id,
        nombre=p.nombre,
        slug=p.slug,
        descripcion=p.descripcion,
        descripcion_corta=p.descripcion_corta,
        destacado=p.destacado,
        marca=MarcaRead.model_validate(p.marca) if p.marca else None,
        categoria=(
            CategoriaRead.model_validate(p.categoria) if p.categoria else None
        ),
        imagenes=[ImagenRead.model_validate(i) for i in p.imagenes],
        variantes=[
            _serialize_variante(v, stock.get(v.id, 0))
            for v in p.variantes
            if v.activo
        ],
        rating_promedio=rating_promedio,
        num_resenas=num_resenas,
    )
