"""Endpoints de checkout y pedidos."""

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    get_current_user_optional,
    require_permissions,
)
from app.core import audit
from app.crud import cart as crud_cart
from app.crud import order as crud_order
from app.db.session import get_db
from app.models.order import Pedido
from app.models.user import Usuario
from app.schemas.order import (
    CheckoutIn,
    EstadoUpdate,
    PedidoAdminItem,
    PedidoRead,
    PedidosAdminPage,
)

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post(
    "/checkout",
    response_model=PedidoRead,
    status_code=status.HTTP_201_CREATED,
    summary="Convertir el carrito en pedido (invitado o usuario)",
)
def checkout(
    body: CheckoutIn,
    db: Session = Depends(get_db),
    user: Usuario | None = Depends(get_current_user_optional),
    x_cart_token: str | None = Header(default=None, alias="X-Cart-Token"),
) -> PedidoRead:
    # Resolver carrito: usuario logueado o invitado por token.
    if user is not None:
        cart = crud_cart.get_user_cart(db, user.id)
    elif x_cart_token:
        cart = crud_cart.get_cart_by_token(db, x_cart_token)
    else:
        cart = None
    if cart is None or not cart.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El carrito está vacío")

    try:
        pedido = crud_order.checkout(
            db,
            cart,
            body,
            usuario_id=user.id if user else None,
            email_cuenta=user.email if user else None,
        )
    except crud_order.StockInsuficienteCheckout as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except crud_order.CheckoutError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return PedidoRead.model_validate(pedido)


@router.get("", response_model=list[PedidoRead], summary="Mis pedidos")
def mis_pedidos(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[PedidoRead]:
    pedidos = db.scalars(
        select(Pedido)
        .where(Pedido.usuario_id == user.id)
        .order_by(Pedido.created_at.desc())
    ).all()
    return [PedidoRead.model_validate(p) for p in pedidos]


# --- Gestión por el personal (admin/vendedor) ---

def _serialize_admin(p: Pedido) -> PedidoAdminItem:
    return PedidoAdminItem(
        id=p.id,
        numero=p.numero,
        email=p.email,
        nombre_contacto=p.nombre_contacto,
        estado=p.estado,
        total=p.total,
        num_items=sum(it.cantidad for it in p.items),
        created_at=p.created_at,
    )


@router.get(
    "/admin",
    response_model=PedidosAdminPage,
    summary="Listar todos los pedidos (personal)",
    dependencies=[Depends(require_permissions("pedidos.leer"))],
)
def listar_pedidos(
    db: Session = Depends(get_db),
    estado: str | None = Query(default=None),
    q: str | None = Query(default=None, description="número o correo"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PedidosAdminPage:
    items, total = crud_order.list_pedidos(
        db, estado=estado, q=q, limit=limit, offset=offset
    )
    return PedidosAdminPage(
        items=[_serialize_admin(p) for p in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/admin/{numero}/estado",
    response_model=PedidoRead,
    summary="Cambiar estado del pedido (pagado/enviado/entregado)",
)
def cambiar_estado_pedido(
    numero: str,
    body: EstadoUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_permissions("pedidos.editar")),
) -> PedidoRead:
    if body.estado == "cancelado":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Usa el endpoint de cancelación"
        )
    pedido = crud_order.get_pedido_by_numero(db, numero)
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    try:
        anterior = crud_order.cambiar_estado(db, pedido, body.estado)
    except crud_order.TransicionInvalidaError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    audit.registrar(
        db,
        actor=user,
        accion="pedidos.editar",
        descripcion=f"Pedido {numero}: {anterior} → {pedido.estado}",
        entidad="pedido",
        entidad_id=numero,
        cambios={"estado": {"antes": anterior, "despues": pedido.estado}},
        request=request,
    )
    return PedidoRead.model_validate(pedido)


@router.post(
    "/admin/{numero}/cancelar",
    response_model=PedidoRead,
    summary="Cancelar pedido (reabastece inventario)",
)
def cancelar(
    numero: str,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_permissions("pedidos.cancelar")),
) -> PedidoRead:
    pedido = crud_order.get_pedido_by_numero(db, numero)
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    try:
        anterior = crud_order.cancelar_pedido(db, pedido)
    except crud_order.TransicionInvalidaError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    audit.registrar(
        db,
        actor=user,
        accion="pedidos.cancelar",
        descripcion=f"Canceló el pedido {numero} (estaba '{anterior}') y reabasteció",
        entidad="pedido",
        entidad_id=numero,
        request=request,
    )
    return PedidoRead.model_validate(pedido)


# --- Detalle de un pedido propio (cliente) — al final para no chocar con /admin ---

@router.get("/{numero}", response_model=PedidoRead, summary="Detalle de pedido")
def detalle_pedido(
    numero: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> PedidoRead:
    pedido = db.scalar(select(Pedido).where(Pedido.numero == numero))
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    # Solo el dueño puede verlo (los de invitado no tienen usuario asociado).
    if pedido.usuario_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado")
    return PedidoRead.model_validate(pedido)
