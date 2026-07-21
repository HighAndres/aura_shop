"""Endpoints administrativos del catálogo: CRUD de productos, marcas y categorías."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import has_permission, require_permissions
from app.core import audit
from app.db.session import get_db
from app.models.catalog import (
    Categoria,
    Marca,
    Producto,
    ProductoImagen,
    Variante,
)
from app.models.user import Usuario
from app.schemas.admin_catalog import (
    CategoriaAdminRead,
    CategoriaCreate,
    CategoriaUpdate,
    MarcaAdminRead,
    MarcaCreate,
    MarcaUpdate,
    ProductoAdminPage,
    ProductoAdminRead,
    ProductoCreate,
    ProductoUpdate,
)

router = APIRouter(prefix="/admin/catalog", tags=["admin-catalog"])


def _user_can_set_prices(user: Usuario) -> bool:
    """¿Puede fijar precio y publicar, o solo dejar el producto en borrador?

    Quien puede crear pero no editar deja el producto inactivo y sin precio,
    para que alguien con "productos.editar" lo revise y lo publique.
    """
    return has_permission(user, "productos.editar")


def _serialize_producto(p: Producto, *, user: Usuario) -> ProductoAdminRead:
    data = ProductoAdminRead.model_validate(p)
    # El costo de proveedor no es para todos los ojos: sin el permiso, el
    # campo viaja en null aunque la fila lo tenga.
    if not has_permission(user, "productos.ver_costo"):
        for v in data.variantes:
            v.costo = None
    return data


# ── Marcas ──────────────────────────────────────────────────────────────

@router.get(
    "/marcas",
    response_model=list[MarcaAdminRead],
    summary="Listar todas las marcas (incluye inactivas)",
    dependencies=[Depends(require_permissions("productos.leer"))],
)
def listar_marcas(db: Session = Depends(get_db)) -> list[MarcaAdminRead]:
    marcas = db.scalars(select(Marca).order_by(Marca.nombre)).all()
    return [MarcaAdminRead.model_validate(m) for m in marcas]


@router.post(
    "/marcas",
    response_model=MarcaAdminRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear marca",
)
def crear_marca(
    body: MarcaCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("marcas.gestionar")),
) -> MarcaAdminRead:
    if db.scalar(select(Marca).where(Marca.slug == body.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Slug ya existe: {body.slug}")

    marca = Marca(**body.model_dump())
    db.add(marca)
    db.commit()
    db.refresh(marca)

    audit.registrar(
        db, actor=current_user, accion="marcas.gestionar",
        descripcion=f"Marca creada: {marca.nombre}",
        entidad="marca", entidad_id=str(marca.id),
        cambios=body.model_dump(), request=request,
    )
    return MarcaAdminRead.model_validate(marca)


@router.put(
    "/marcas/{marca_id}",
    response_model=MarcaAdminRead,
    summary="Editar marca",
)
def editar_marca(
    marca_id: str,
    body: MarcaUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("marcas.gestionar")),
) -> MarcaAdminRead:
    marca = db.get(Marca, marca_id)
    if marca is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Marca no encontrada")

    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(marca, k, v)
    db.commit()
    db.refresh(marca)

    audit.registrar(
        db, actor=current_user, accion="marcas.gestionar",
        descripcion=f"Marca editada: {marca.nombre}",
        entidad="marca", entidad_id=str(marca.id),
        cambios=changes, request=request,
    )
    return MarcaAdminRead.model_validate(marca)


# ── Categorías ──────────────────────────────────────────────────────────

@router.get(
    "/categorias",
    response_model=list[CategoriaAdminRead],
    summary="Listar todas las categorías (incluye inactivas)",
    dependencies=[Depends(require_permissions("productos.leer"))],
)
def listar_categorias(db: Session = Depends(get_db)) -> list[CategoriaAdminRead]:
    cats = db.scalars(
        select(Categoria).order_by(Categoria.orden, Categoria.nombre)
    ).all()
    return [CategoriaAdminRead.model_validate(c) for c in cats]


@router.post(
    "/categorias",
    response_model=CategoriaAdminRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear categoría",
)
def crear_categoria(
    body: CategoriaCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("categorias.gestionar")),
) -> CategoriaAdminRead:
    if db.scalar(select(Categoria).where(Categoria.slug == body.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Slug ya existe: {body.slug}")

    cat = Categoria(**body.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)

    audit.registrar(
        db, actor=current_user, accion="categorias.gestionar",
        descripcion=f"Categoría creada: {cat.nombre}",
        entidad="categoria", entidad_id=str(cat.id),
        cambios=body.model_dump(mode="json"), request=request,
    )
    return CategoriaAdminRead.model_validate(cat)


@router.put(
    "/categorias/{categoria_id}",
    response_model=CategoriaAdminRead,
    summary="Editar categoría",
)
def editar_categoria(
    categoria_id: str,
    body: CategoriaUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("categorias.gestionar")),
) -> CategoriaAdminRead:
    cat = db.get(Categoria, categoria_id)
    if cat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoría no encontrada")

    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)

    audit.registrar(
        db, actor=current_user, accion="categorias.gestionar",
        descripcion=f"Categoría editada: {cat.nombre}",
        entidad="categoria", entidad_id=str(cat.id),
        cambios=changes, request=request,
    )
    return CategoriaAdminRead.model_validate(cat)


# ── Productos ───────────────────────────────────────────────────────────

@router.get(
    "/productos",
    response_model=ProductoAdminPage,
    summary="Listar productos (admin, incluye inactivos)",
)
def listar_productos_admin(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("productos.leer")),
    q: str | None = Query(default=None),
    activo: bool | None = Query(default=None),
    marca_id: str | None = Query(default=None),
    categoria_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ProductoAdminPage:
    query = select(Producto)
    count_q = select(func.count()).select_from(Producto)

    if q:
        esc = q.replace("%", r"\%").replace("_", r"\_")
        # Busca también por SKU y código de barras: al levantar un pedido el
        # vendedor teclea el código del producto, no su nombre exacto.
        # any() genera un EXISTS y evita duplicar el producto por variante.
        filtro = (
            Producto.nombre.ilike(f"%{esc}%")
            | Producto.slug.ilike(f"%{esc}%")
            | Producto.variantes.any(
                Variante.sku.ilike(f"%{esc}%")
                | Variante.codigo_barras.ilike(f"%{esc}%")
            )
        )
        query = query.where(filtro)
        count_q = count_q.where(filtro)
    if activo is not None:
        query = query.where(Producto.activo == activo)
        count_q = count_q.where(Producto.activo == activo)
    if marca_id:
        query = query.where(Producto.marca_id == marca_id)
        count_q = count_q.where(Producto.marca_id == marca_id)
    if categoria_id:
        query = query.where(Producto.categoria_id == categoria_id)
        count_q = count_q.where(Producto.categoria_id == categoria_id)

    total = db.scalar(count_q) or 0
    items = db.scalars(
        query.order_by(Producto.nombre).offset(offset).limit(limit)
    ).all()

    return ProductoAdminPage(
        items=[_serialize_producto(p, user=current_user) for p in items],
        total=total, limit=limit, offset=offset,
    )


@router.get(
    "/productos/{producto_id}",
    response_model=ProductoAdminRead,
    summary="Detalle de producto por ID (admin)",
)
def detalle_producto_admin(
    producto_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("productos.leer")),
) -> ProductoAdminRead:
    producto = db.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    return _serialize_producto(producto, user=current_user)


@router.post(
    "/productos",
    response_model=ProductoAdminRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear producto con variantes e imágenes",
)
def crear_producto(
    body: ProductoCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("productos.crear")),
) -> ProductoAdminRead:
    if db.scalar(select(Producto).where(Producto.slug == body.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Slug ya existe: {body.slug}")

    for v in body.variantes:
        if db.scalar(select(Variante).where(Variante.sku == v.sku)):
            raise HTTPException(status.HTTP_409_CONFLICT, f"SKU ya existe: {v.sku}")

    can_price = _user_can_set_prices(current_user)

    producto = Producto(
        nombre=body.nombre,
        slug=body.slug,
        descripcion=body.descripcion,
        descripcion_corta=body.descripcion_corta,
        marca_id=body.marca_id,
        categoria_id=body.categoria_id,
        destacado=body.destacado if can_price else False,
        activo=can_price,
    )

    for v in body.variantes:
        v_data = v.model_dump()
        if not can_price:
            v_data["precio"] = 0
            v_data["precio_comparativo"] = None
            v_data["costo"] = None
        producto.variantes.append(Variante(**v_data))

    for img in body.imagenes:
        producto.imagenes.append(ProductoImagen(**img.model_dump()))

    db.add(producto)
    db.commit()
    db.refresh(producto)

    audit.registrar(
        db, actor=current_user, accion="productos.crear",
        descripcion=f"Producto creado: {producto.nombre}",
        entidad="producto", entidad_id=str(producto.id),
        cambios=body.model_dump(mode="json"), request=request,
    )
    return _serialize_producto(producto, user=current_user)


@router.put(
    "/productos/{producto_id}",
    response_model=ProductoAdminRead,
    summary="Editar producto",
)
def editar_producto(
    producto_id: str,
    body: ProductoUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("productos.editar")),
) -> ProductoAdminRead:
    producto = db.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")

    can_price = _user_can_set_prices(current_user)
    changes = body.model_dump(exclude_unset=True)

    editable_fields = ["nombre", "slug", "descripcion", "descripcion_corta",
                       "marca_id", "categoria_id"]
    if can_price:
        editable_fields.append("destacado")
    for field in editable_fields:
        if field in changes:
            setattr(producto, field, changes[field])

    if "variantes" in changes and body.variantes is not None:
        existing_skus = {v.sku: v for v in producto.variantes}
        incoming_skus = {v.sku for v in body.variantes}

        if can_price:
            for v in list(producto.variantes):
                if v.sku not in incoming_skus:
                    db.delete(v)

        for v_in in body.variantes:
            if v_in.sku in existing_skus:
                existing = existing_skus[v_in.sku]
                existing.nombre = v_in.nombre
                if can_price:
                    existing.precio = v_in.precio
                    existing.precio_comparativo = v_in.precio_comparativo
                    existing.costo = v_in.costo
                    existing.activo = v_in.activo
            else:
                v_data = v_in.model_dump()
                if not can_price:
                    v_data["precio"] = 0
                    v_data["precio_comparativo"] = None
                    v_data["costo"] = None
                if db.scalar(select(Variante).where(Variante.sku == v_in.sku)):
                    raise HTTPException(
                        status.HTTP_409_CONFLICT, f"SKU ya existe: {v_in.sku}"
                    )
                producto.variantes.append(Variante(**v_data))

    if "imagenes" in changes and body.imagenes is not None:
        for img in list(producto.imagenes):
            db.delete(img)
        for img_in in body.imagenes:
            producto.imagenes.append(ProductoImagen(**img_in.model_dump()))

    db.commit()
    db.refresh(producto)

    audit.registrar(
        db, actor=current_user, accion="productos.editar",
        descripcion=f"Producto editado: {producto.nombre}",
        entidad="producto", entidad_id=str(producto.id),
        cambios=body.model_dump(exclude_unset=True, mode="json"), request=request,
    )
    return _serialize_producto(producto, user=current_user)


@router.patch(
    "/productos/{producto_id}/activar",
    response_model=ProductoAdminRead,
    summary="Activar/desactivar producto",
)
def toggle_producto(
    producto_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("productos.editar")),
) -> ProductoAdminRead:
    producto = db.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")

    nuevo_estado = not producto.activo
    if nuevo_estado:
        from decimal import Decimal
        tiene_precio = any(v.precio > Decimal(0) for v in producto.variantes)
        if not tiene_precio:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "No se puede activar un producto sin precio asignado",
            )

    producto.activo = nuevo_estado
    db.commit()
    db.refresh(producto)

    audit.registrar(
        db, actor=current_user, accion="productos.editar",
        descripcion=f"Producto {'activado' if producto.activo else 'desactivado'}: {producto.nombre}",
        entidad="producto", entidad_id=str(producto.id),
        cambios={"activo": producto.activo}, request=request,
    )
    return _serialize_producto(producto, user=current_user)


@router.delete(
    "/productos/{producto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar producto",
)
def eliminar_producto(
    producto_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("productos.eliminar")),
) -> None:
    producto = db.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")

    nombre = producto.nombre
    db.delete(producto)
    db.commit()

    audit.registrar(
        db, actor=current_user, accion="productos.eliminar",
        descripcion=f"Producto eliminado: {nombre}",
        entidad="producto", entidad_id=producto_id,
        request=request,
    )
