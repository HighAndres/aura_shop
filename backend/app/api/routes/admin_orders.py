"""Endpoints administrativos de pedidos (staff con permisos pedidos.*)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.core import audit
from app.db.session import get_db
from app.models.order import EstadoPedido, Pedido
from app.models.user import Usuario
from app.schemas.order import PedidoRead

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])

TRANSICIONES_VALIDAS: dict[str, list[str]] = {
    "pendiente": ["pagado", "cancelado"],
    "pagado": ["enviado", "cancelado"],
    "enviado": ["entregado"],
    "entregado": [],
    "cancelado": [],
}


from pydantic import BaseModel


class PedidoPage(BaseModel):
    items: list[PedidoRead]
    total: int
    limit: int
    offset: int


class CambiarEstadoIn(BaseModel):
    estado: str
    nota: str | None = None


@router.get(
    "",
    response_model=PedidoPage,
    summary="Listar todos los pedidos (admin)",
    dependencies=[Depends(require_permissions("pedidos.leer"))],
)
def listar_pedidos_admin(
    db: Session = Depends(get_db),
    estado: str | None = Query(default=None),
    q: str | None = Query(default=None, description="buscar por número o email"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PedidoPage:
    query = select(Pedido)
    count_query = select(func.count()).select_from(Pedido)

    if estado:
        query = query.where(Pedido.estado == estado)
        count_query = count_query.where(Pedido.estado == estado)
    if q:
        filtro = Pedido.numero.ilike(f"%{q}%") | Pedido.email.ilike(f"%{q}%")
        query = query.where(filtro)
        count_query = count_query.where(filtro)

    total = db.scalar(count_query) or 0
    pedidos = db.scalars(
        query.order_by(Pedido.created_at.desc()).offset(offset).limit(limit)
    ).all()

    return PedidoPage(
        items=[PedidoRead.model_validate(p) for p in pedidos],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.put(
    "/{numero}/estado",
    response_model=PedidoRead,
    summary="Cambiar estado de un pedido",
)
def cambiar_estado(
    numero: str,
    body: CambiarEstadoIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("pedidos.editar")),
) -> PedidoRead:
    pedido = db.scalar(select(Pedido).where(Pedido.numero == numero))
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")

    if body.estado not in [e.value for e in EstadoPedido]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Estado inválido: {body.estado}")

    validos = TRANSICIONES_VALIDAS.get(pedido.estado, [])
    if body.estado not in validos:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"No se puede cambiar de '{pedido.estado}' a '{body.estado}'. "
            f"Transiciones válidas: {validos}",
        )

    estado_anterior = pedido.estado
    pedido.estado = body.estado
    db.commit()
    db.refresh(pedido)

    audit.registrar(
        db,
        actor=current_user,
        accion="pedidos.editar",
        descripcion=f"Pedido {numero}: {estado_anterior} → {body.estado}",
        entidad="pedido",
        entidad_id=numero,
        cambios={
            "estado_anterior": estado_anterior,
            "estado_nuevo": body.estado,
            "nota": body.nota,
        },
        request=request,
    )

    return PedidoRead.model_validate(pedido)


@router.put(
    "/{numero}/cancelar",
    response_model=PedidoRead,
    summary="Cancelar un pedido",
)
def cancelar_pedido(
    numero: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("pedidos.cancelar")),
) -> PedidoRead:
    pedido = db.scalar(select(Pedido).where(Pedido.numero == numero))
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")

    if pedido.estado == "cancelado":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El pedido ya está cancelado")
    if pedido.estado == "entregado":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "No se puede cancelar un pedido entregado"
        )

    estado_anterior = pedido.estado
    pedido.estado = "cancelado"
    db.commit()
    db.refresh(pedido)

    audit.registrar(
        db,
        actor=current_user,
        accion="pedidos.cancelar",
        descripcion=f"Pedido {numero} cancelado (era: {estado_anterior})",
        entidad="pedido",
        entidad_id=numero,
        cambios={"estado_anterior": estado_anterior, "estado_nuevo": "cancelado"},
        request=request,
    )

    return PedidoRead.model_validate(pedido)
