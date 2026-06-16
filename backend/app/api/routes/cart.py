"""Endpoints de carrito. Funciona para invitado (X-Cart-Token) y usuario."""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_user_optional
from app.crud import cart as crud
from app.db.session import get_db
from app.models.cart import Carrito
from app.models.user import Usuario
from app.schemas.cart import CartItemIn, CartItemUpdate, CartRead, MergeRequest

router = APIRouter(prefix="/cart", tags=["cart"])


def _resolve(
    db: Session,
    user: Usuario | None,
    token: str | None,
    *,
    create: bool,
) -> Carrito | None:
    if user is not None:
        return (
            crud.get_or_create_user_cart(db, user.id)
            if create
            else crud.get_user_cart(db, user.id)
        )
    if token:
        cart = crud.get_cart_by_token(db, token)
        if cart is not None:
            return cart
    return crud.create_guest_cart(db) if create else None


@router.get("", response_model=CartRead, summary="Ver carrito")
def ver_carrito(
    db: Session = Depends(get_db),
    user: Usuario | None = Depends(get_current_user_optional),
    x_cart_token: str | None = Header(default=None, alias="X-Cart-Token"),
) -> CartRead:
    cart = _resolve(db, user, x_cart_token, create=False)
    return crud.serialize_cart(db, cart)


@router.post("/items", response_model=CartRead, summary="Agregar al carrito")
def agregar_item(
    body: CartItemIn,
    db: Session = Depends(get_db),
    user: Usuario | None = Depends(get_current_user_optional),
    x_cart_token: str | None = Header(default=None, alias="X-Cart-Token"),
) -> CartRead:
    variante = crud.get_variante_by_sku(db, body.sku)
    if variante is None or not variante.activo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"SKU no disponible: {body.sku}")
    cart = _resolve(db, user, x_cart_token, create=True)
    crud.add_item(db, cart, variante, body.cantidad)
    return crud.serialize_cart(db, cart)


@router.put("/items/{sku}", response_model=CartRead, summary="Actualizar cantidad")
def actualizar_item(
    sku: str,
    body: CartItemUpdate,
    db: Session = Depends(get_db),
    user: Usuario | None = Depends(get_current_user_optional),
    x_cart_token: str | None = Header(default=None, alias="X-Cart-Token"),
) -> CartRead:
    cart = _resolve(db, user, x_cart_token, create=False)
    if cart is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Carrito no encontrado")
    variante = crud.get_variante_by_sku(db, sku)
    if variante is None or not crud.set_item(db, cart, variante.id, body.cantidad):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no está en el carrito")
    return crud.serialize_cart(db, cart)


@router.delete("/items/{sku}", response_model=CartRead, summary="Quitar del carrito")
def quitar_item(
    sku: str,
    db: Session = Depends(get_db),
    user: Usuario | None = Depends(get_current_user_optional),
    x_cart_token: str | None = Header(default=None, alias="X-Cart-Token"),
) -> CartRead:
    cart = _resolve(db, user, x_cart_token, create=False)
    if cart is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Carrito no encontrado")
    variante = crud.get_variante_by_sku(db, sku)
    if variante is not None:
        crud.remove_item(db, cart, variante.id)
    return crud.serialize_cart(db, cart)


@router.post("/merge", response_model=CartRead, summary="Fusionar carrito de invitado")
def fusionar_carrito(
    body: MergeRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> CartRead:
    """Tras iniciar sesión: mezcla el carrito de invitado (token) en el del usuario."""
    invitado = crud.get_cart_by_token(db, body.token)
    destino = crud.get_or_create_user_cart(db, user.id)
    if invitado is not None and invitado.id != destino.id:
        crud.merge_carts(db, invitado, destino)
    return crud.serialize_cart(db, destino)
