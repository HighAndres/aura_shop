"""Endpoints de checkout y pedidos."""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_user_optional
from app.crud import cart as crud_cart
from app.crud import order as crud_order
from app.db.session import get_db
from app.models.order import Pedido
from app.models.user import Usuario
from app.schemas.order import CheckoutIn, PedidoRead

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
    if cart is None or (not cart.items and not cart.paquetes):
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
