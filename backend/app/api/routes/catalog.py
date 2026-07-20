"""Endpoints públicos del catálogo (tienda). Sin autenticación."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud import bundle as crud_bundle
from app.crud import catalog as crud
from app.crud import inventory as crud_inv
from app.db.session import get_db
from app.schemas.bundle import PaquetePublic, PaquetesPublicPage
from app.schemas.catalog import (
    CategoriaRead,
    MarcaRead,
    ProductoDetail,
    ProductosPage,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/marcas", response_model=list[MarcaRead], summary="Listar marcas")
def listar_marcas(db: Session = Depends(get_db)) -> list[MarcaRead]:
    return [MarcaRead.model_validate(m) for m in crud.list_marcas(db)]


@router.get(
    "/categorias",
    response_model=list[CategoriaRead],
    summary="Listar categorías",
)
def listar_categorias(db: Session = Depends(get_db)) -> list[CategoriaRead]:
    return [CategoriaRead.model_validate(c) for c in crud.list_categorias(db)]


@router.get(
    "/productos",
    response_model=ProductosPage,
    summary="Listar/buscar productos",
)
def listar_productos(
    db: Session = Depends(get_db),
    categoria: str | None = Query(default=None, description="slug de categoría"),
    marca: str | None = Query(default=None, description="slug de marca"),
    q: str | None = Query(default=None, description="búsqueda por nombre"),
    destacado: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ProductosPage:
    items, total = crud.list_productos(
        db,
        categoria_slug=categoria,
        marca_slug=marca,
        q=q,
        destacado=destacado,
        limit=limit,
        offset=offset,
    )
    return ProductosPage(
        items=[crud.serialize_list_item(p) for p in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/paquetes",
    response_model=PaquetesPublicPage,
    summary="Listar paquetes activos",
)
def listar_paquetes(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PaquetesPublicPage:
    items, total = crud_bundle.list_paquetes_activos(db, limit=limit, offset=offset)
    return PaquetesPublicPage(
        items=[crud_bundle.serialize_public(p) for p in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/paquetes/{slug}",
    response_model=PaquetePublic,
    summary="Detalle de paquete por slug",
)
def detalle_paquete(slug: str, db: Session = Depends(get_db)) -> PaquetePublic:
    paquete = crud_bundle.get_paquete_activo_by_slug(db, slug)
    if paquete is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Paquete no encontrado"
        )
    return crud_bundle.serialize_public(paquete)


@router.get(
    "/productos/{slug}",
    response_model=ProductoDetail,
    summary="Detalle de producto por slug",
)
def detalle_producto(slug: str, db: Session = Depends(get_db)) -> ProductoDetail:
    producto = crud.get_producto_by_slug(db, slug)
    if producto is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado"
        )
    rating, num = crud.rating_de_producto(db, producto.id)
    stock = crud_inv.disponible_por_variantes(
        db, [v.id for v in producto.variantes]
    )
    return crud.serialize_detail(producto, rating, num, stock)
