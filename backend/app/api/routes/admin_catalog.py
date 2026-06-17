"""Administración del catálogo (escritura). RBAC + bitácora en cada acción."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.core import audit
from app.crud import admin_catalog as crud
from app.db.session import get_db
from app.models.user import Usuario
from app.schemas.admin import (
    CategoriaCreate,
    MarcaCreate,
    ProductoAdminRead,
    ProductoCreate,
    ProductoUpdate,
    VarianteAdminRead,
    VarianteCreate,
    VarianteUpdate,
)
from app.schemas.catalog import CategoriaRead, MarcaRead

router = APIRouter(prefix="/admin/catalog", tags=["admin-catalog"])


# --- Productos ---

@router.get(
    "/productos",
    response_model=list[ProductoAdminRead],
    summary="Listar productos (incluye inactivos)",
    dependencies=[Depends(require_permissions("productos.leer"))],
)
def listar(
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[ProductoAdminRead]:
    items, _ = crud.list_productos_admin(db, q=q, limit=limit, offset=offset)
    return [crud.serialize_admin_item(p) for p in items]


@router.post(
    "/productos",
    response_model=ProductoAdminRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear producto",
)
def crear_producto(
    body: ProductoCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_permissions("productos.crear")),
) -> ProductoAdminRead:
    producto = crud.create_producto(db, body)
    audit.registrar(
        db,
        actor=user,
        accion="productos.crear",
        descripcion=f"Creó el producto '{producto.nombre}' ({producto.slug})",
        entidad="producto",
        entidad_id=str(producto.id),
        cambios=body.model_dump(mode="json"),
        request=request,
    )
    return crud.serialize_admin_item(producto)


@router.put(
    "/productos/{producto_id}",
    response_model=ProductoAdminRead,
    summary="Editar producto",
)
def editar_producto(
    producto_id: uuid.UUID,
    body: ProductoUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_permissions("productos.editar")),
) -> ProductoAdminRead:
    producto = crud.get_producto(db, producto_id)
    if producto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    producto, cambios = crud.update_producto(db, producto, body)
    audit.registrar(
        db,
        actor=user,
        accion="productos.editar",
        descripcion=f"Editó el producto '{producto.nombre}'",
        entidad="producto",
        entidad_id=str(producto.id),
        cambios=cambios,
        request=request,
    )
    return crud.serialize_admin_item(producto)


@router.delete(
    "/productos/{producto_id}",
    response_model=ProductoAdminRead,
    summary="Desactivar producto (baja lógica)",
)
def desactivar_producto(
    producto_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_permissions("productos.eliminar")),
) -> ProductoAdminRead:
    producto = crud.get_producto(db, producto_id)
    if producto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    crud.deactivate_producto(db, producto)
    audit.registrar(
        db,
        actor=user,
        accion="productos.eliminar",
        descripcion=f"Desactivó el producto '{producto.nombre}'",
        entidad="producto",
        entidad_id=str(producto.id),
        request=request,
    )
    return crud.serialize_admin_item(producto)


# --- Variantes ---

@router.post(
    "/productos/{producto_id}/variantes",
    response_model=VarianteAdminRead,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar variante a un producto",
)
def crear_variante(
    producto_id: uuid.UUID,
    body: VarianteCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_permissions("productos.editar")),
) -> VarianteAdminRead:
    producto = crud.get_producto(db, producto_id)
    if producto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    try:
        variante = crud.create_variante(db, producto, body)
    except crud.DuplicadoError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    audit.registrar(
        db,
        actor=user,
        accion="productos.editar",
        descripcion=f"Agregó la variante {variante.sku} a '{producto.nombre}'",
        entidad="variante",
        entidad_id=str(variante.id),
        cambios=body.model_dump(mode="json"),
        request=request,
    )
    return VarianteAdminRead.model_validate(variante)


@router.put(
    "/variantes/{variante_id}",
    response_model=VarianteAdminRead,
    summary="Editar variante (precio, etc.)",
)
def editar_variante(
    variante_id: uuid.UUID,
    body: VarianteUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_permissions("productos.editar")),
) -> VarianteAdminRead:
    variante = crud.get_variante(db, variante_id)
    if variante is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Variante no encontrada")
    variante, cambios = crud.update_variante(db, variante, body)
    audit.registrar(
        db,
        actor=user,
        accion="productos.editar",
        descripcion=f"Editó la variante {variante.sku}",
        entidad="variante",
        entidad_id=str(variante.id),
        cambios=cambios,
        request=request,
    )
    return VarianteAdminRead.model_validate(variante)


# --- Marcas / Categorías ---

@router.post(
    "/marcas",
    response_model=MarcaRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear marca",
)
def crear_marca(
    body: MarcaCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_permissions("productos.crear")),
) -> MarcaRead:
    marca = crud.create_marca(db, body)
    audit.registrar(
        db,
        actor=user,
        accion="productos.crear",
        descripcion=f"Creó la marca '{marca.nombre}'",
        entidad="marca",
        entidad_id=str(marca.id),
        request=request,
    )
    return MarcaRead.model_validate(marca)


@router.post(
    "/categorias",
    response_model=CategoriaRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear categoría",
)
def crear_categoria(
    body: CategoriaCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_permissions("productos.crear")),
) -> CategoriaRead:
    categoria = crud.create_categoria(db, body)
    audit.registrar(
        db,
        actor=user,
        accion="productos.crear",
        descripcion=f"Creó la categoría '{categoria.nombre}'",
        entidad="categoria",
        entidad_id=str(categoria.id),
        request=request,
    )
    return CategoriaRead.model_validate(categoria)
