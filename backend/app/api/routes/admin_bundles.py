"""Endpoints administrativos de paquetes: CRUD de bundles."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.core import audit
from app.db.session import get_db
from app.models.bundle import Paquete, PaqueteItem
from app.models.catalog import Producto, Variante
from app.models.user import Usuario
from app.schemas.bundle import (
    PaqueteAdminPage,
    PaqueteAdminRead,
    PaqueteCreate,
    PaqueteItemRead,
    PaqueteUpdate,
)

router = APIRouter(prefix="/admin/paquetes", tags=["admin-paquetes"])


def _calc_precio_individual(items: list[PaqueteItem]) -> Decimal:
    total = Decimal(0)
    for item in items:
        if item.variante:
            total += item.variante.precio * item.cantidad
        elif item.producto and item.producto.variantes:
            activas = [v.precio for v in item.producto.variantes if v.activo]
            if activas:
                total += min(activas) * item.cantidad
    return total


def _serialize_item(item: PaqueteItem) -> PaqueteItemRead:
    return PaqueteItemRead(
        id=item.id,
        producto_id=item.producto_id,
        variante_id=item.variante_id,
        cantidad=item.cantidad,
        orden=item.orden,
        producto_nombre=item.producto.nombre if item.producto else None,
        variante_sku=item.variante.sku if item.variante else None,
        precio_unitario=item.variante.precio if item.variante else (
            min((v.precio for v in item.producto.variantes if v.activo), default=Decimal(0))
            if item.producto and item.producto.variantes else Decimal(0)
        ),
    )


def _serialize_paquete(p: Paquete) -> PaqueteAdminRead:
    precio_ind = _calc_precio_individual(p.items)
    return PaqueteAdminRead(
        id=p.id,
        nombre=p.nombre,
        slug=p.slug,
        descripcion=p.descripcion,
        descripcion_corta=p.descripcion_corta,
        imagen_url=p.imagen_url,
        precio_paquete=p.precio_paquete,
        precio_individual=precio_ind,
        ahorro=precio_ind - p.precio_paquete,
        activo=p.activo,
        destacado=p.destacado,
        items=[_serialize_item(i) for i in p.items],
        created_at=p.created_at,
    )


@router.get(
    "",
    response_model=PaqueteAdminPage,
    summary="Listar paquetes (admin)",
    dependencies=[Depends(require_permissions("paquetes.gestionar"))],
)
def listar_paquetes(
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
    activo: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PaqueteAdminPage:
    query = select(Paquete)
    count_q = select(func.count()).select_from(Paquete)

    if q:
        esc = q.replace("%", r"\%").replace("_", r"\_")
        filtro = Paquete.nombre.ilike(f"%{esc}%")
        query = query.where(filtro)
        count_q = count_q.where(filtro)
    if activo is not None:
        query = query.where(Paquete.activo == activo)
        count_q = count_q.where(Paquete.activo == activo)

    total = db.scalar(count_q) or 0
    items = db.scalars(
        query.order_by(Paquete.nombre).offset(offset).limit(limit)
    ).all()

    return PaqueteAdminPage(
        items=[_serialize_paquete(p) for p in items],
        total=total, limit=limit, offset=offset,
    )


@router.get(
    "/{paquete_id}",
    response_model=PaqueteAdminRead,
    summary="Detalle de paquete (admin)",
    dependencies=[Depends(require_permissions("paquetes.gestionar"))],
)
def detalle_paquete(
    paquete_id: str,
    db: Session = Depends(get_db),
) -> PaqueteAdminRead:
    paquete = db.get(Paquete, paquete_id)
    if paquete is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paquete no encontrado")
    return _serialize_paquete(paquete)


@router.post(
    "",
    response_model=PaqueteAdminRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear paquete",
)
def crear_paquete(
    body: PaqueteCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("paquetes.gestionar")),
) -> PaqueteAdminRead:
    if db.scalar(select(Paquete).where(Paquete.slug == body.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Slug ya existe: {body.slug}")

    for item in body.items:
        if not db.get(Producto, str(item.producto_id)):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Producto no encontrado: {item.producto_id}")
        if item.variante_id:
            variante = db.get(Variante, str(item.variante_id))
            if not variante:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Variante no encontrada: {item.variante_id}")
            if str(variante.producto_id) != str(item.producto_id):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"La variante {item.variante_id} no pertenece al producto {item.producto_id}")

    paquete = Paquete(
        nombre=body.nombre,
        slug=body.slug,
        descripcion=body.descripcion,
        descripcion_corta=body.descripcion_corta,
        imagen_url=body.imagen_url,
        precio_paquete=body.precio_paquete,
        destacado=body.destacado,
    )

    for item in body.items:
        paquete.items.append(PaqueteItem(
            producto_id=item.producto_id,
            variante_id=item.variante_id,
            cantidad=item.cantidad,
            orden=item.orden,
        ))

    db.add(paquete)
    db.commit()
    db.refresh(paquete)

    audit.registrar(
        db, actor=current_user, accion="paquetes.gestionar",
        descripcion=f"Paquete creado: {paquete.nombre}",
        entidad="paquete", entidad_id=str(paquete.id),
        cambios=body.model_dump(mode="json"), request=request,
    )
    return _serialize_paquete(paquete)


@router.put(
    "/{paquete_id}",
    response_model=PaqueteAdminRead,
    summary="Editar paquete",
)
def editar_paquete(
    paquete_id: str,
    body: PaqueteUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("paquetes.gestionar")),
) -> PaqueteAdminRead:
    paquete = db.get(Paquete, paquete_id)
    if paquete is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paquete no encontrado")

    changes = body.model_dump(exclude_unset=True)

    for field in ["nombre", "slug", "descripcion", "descripcion_corta",
                   "imagen_url", "precio_paquete", "destacado"]:
        if field in changes:
            setattr(paquete, field, changes[field])

    if "items" in changes and body.items is not None:
        for item in list(paquete.items):
            db.delete(item)

        for item_in in body.items:
            if not db.get(Producto, str(item_in.producto_id)):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Producto no encontrado: {item_in.producto_id}")
            if item_in.variante_id:
                variante = db.get(Variante, str(item_in.variante_id))
                if not variante:
                    raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Variante no encontrada: {item_in.variante_id}")
                if str(variante.producto_id) != str(item_in.producto_id):
                    raise HTTPException(status.HTTP_400_BAD_REQUEST, f"La variante {item_in.variante_id} no pertenece al producto {item_in.producto_id}")
            paquete.items.append(PaqueteItem(
                producto_id=item_in.producto_id,
                variante_id=item_in.variante_id,
                cantidad=item_in.cantidad,
                orden=item_in.orden,
            ))

    db.commit()
    db.refresh(paquete)

    audit.registrar(
        db, actor=current_user, accion="paquetes.gestionar",
        descripcion=f"Paquete editado: {paquete.nombre}",
        entidad="paquete", entidad_id=str(paquete.id),
        cambios=body.model_dump(exclude_unset=True, mode="json"), request=request,
    )
    return _serialize_paquete(paquete)


@router.patch(
    "/{paquete_id}/activar",
    response_model=PaqueteAdminRead,
    summary="Activar/desactivar paquete",
)
def toggle_paquete(
    paquete_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("paquetes.gestionar")),
) -> PaqueteAdminRead:
    paquete = db.get(Paquete, paquete_id)
    if paquete is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paquete no encontrado")

    paquete.activo = not paquete.activo
    db.commit()
    db.refresh(paquete)

    audit.registrar(
        db, actor=current_user, accion="paquetes.gestionar",
        descripcion=f"Paquete {'activado' if paquete.activo else 'desactivado'}: {paquete.nombre}",
        entidad="paquete", entidad_id=str(paquete.id),
        cambios={"activo": paquete.activo}, request=request,
    )
    return _serialize_paquete(paquete)


@router.delete(
    "/{paquete_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar paquete",
)
def eliminar_paquete(
    paquete_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("paquetes.gestionar")),
) -> None:
    paquete = db.get(Paquete, paquete_id)
    if paquete is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paquete no encontrado")

    nombre = paquete.nombre
    db.delete(paquete)
    db.commit()

    audit.registrar(
        db, actor=current_user, accion="paquetes.gestionar",
        descripcion=f"Paquete eliminado: {nombre}",
        entidad="paquete", entidad_id=paquete_id,
        request=request,
    )
