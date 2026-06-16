"""Lógica del carrito: resolución (usuario/invitado), items y serialización."""

import secrets
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import inventory as crud_inv
from app.models.cart import Carrito, CarritoItem
from app.models.catalog import Variante
from app.schemas.cart import CartItemRead, CartRead


def _nuevo_token() -> str:
    return secrets.token_urlsafe(24)


# --- Resolución de carrito ---

def get_user_cart(db: Session, user_id: uuid.UUID) -> Carrito | None:
    return db.scalar(
        select(Carrito).where(
            Carrito.usuario_id == user_id, Carrito.estado == "activo"
        )
    )


def get_or_create_user_cart(db: Session, user_id: uuid.UUID) -> Carrito:
    cart = get_user_cart(db, user_id)
    if cart is None:
        cart = Carrito(usuario_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def get_cart_by_token(db: Session, token: str) -> Carrito | None:
    return db.scalar(
        select(Carrito).where(Carrito.token == token, Carrito.estado == "activo")
    )


def create_guest_cart(db: Session) -> Carrito:
    cart = Carrito(token=_nuevo_token())
    db.add(cart)
    db.commit()
    db.refresh(cart)
    return cart


# --- Items ---

def get_variante_by_sku(db: Session, sku: str) -> Variante | None:
    return db.scalar(select(Variante).where(Variante.sku == sku))


def add_item(db: Session, cart: Carrito, variante: Variante, cantidad: int) -> Carrito:
    item = db.scalar(
        select(CarritoItem).where(
            CarritoItem.carrito_id == cart.id,
            CarritoItem.variante_id == variante.id,
        )
    )
    if item:
        item.cantidad = min(item.cantidad + cantidad, 999)
    else:
        db.add(CarritoItem(carrito_id=cart.id, variante_id=variante.id, cantidad=cantidad))
    db.commit()
    db.refresh(cart)
    return cart


def set_item(db: Session, cart: Carrito, variante_id: uuid.UUID, cantidad: int) -> bool:
    item = db.scalar(
        select(CarritoItem).where(
            CarritoItem.carrito_id == cart.id,
            CarritoItem.variante_id == variante_id,
        )
    )
    if item is None:
        return False
    item.cantidad = cantidad
    db.commit()
    return True


def remove_item(db: Session, cart: Carrito, variante_id: uuid.UUID) -> None:
    item = db.scalar(
        select(CarritoItem).where(
            CarritoItem.carrito_id == cart.id,
            CarritoItem.variante_id == variante_id,
        )
    )
    if item:
        db.delete(item)
        db.commit()


def merge_carts(db: Session, source: Carrito, target: Carrito) -> Carrito:
    """Fusiona el carrito de invitado (source) en el del usuario (target)."""
    destino = {i.variante_id: i for i in target.items}
    for item in source.items:
        if item.variante_id in destino:
            destino[item.variante_id].cantidad = min(
                destino[item.variante_id].cantidad + item.cantidad, 999
            )
        else:
            db.add(
                CarritoItem(
                    carrito_id=target.id,
                    variante_id=item.variante_id,
                    cantidad=item.cantidad,
                )
            )
    source.estado = "abandonado"
    db.commit()
    db.refresh(target)
    return target


# --- Serialización ---

def serialize_cart(db: Session, cart: Carrito | None) -> CartRead:
    if cart is None:
        return CartRead()

    stock = crud_inv.disponible_por_variantes(
        db, [i.variante_id for i in cart.items]
    )
    items: list[CartItemRead] = []
    subtotal = Decimal("0.00")
    for it in cart.items:
        v = it.variante
        prod = v.producto
        imagen = None
        if prod.imagenes:
            principal = next((im for im in prod.imagenes if im.es_principal), None)
            imagen = (principal or prod.imagenes[0]).url
        etiqueta = v.nombre or " · ".join(
            f"{val.atributo.nombre}: {val.valor}" for val in v.valores
        )
        nombre = f"{prod.nombre}" + (f" — {etiqueta}" if etiqueta else "")
        linea = (v.precio * it.cantidad).quantize(Decimal("0.01"))
        subtotal += linea
        items.append(
            CartItemRead(
                variante_id=v.id,
                sku=v.sku,
                nombre=nombre,
                producto_slug=prod.slug,
                imagen=imagen,
                precio_unitario=v.precio,
                cantidad=it.cantidad,
                subtotal=linea,
                disponible=stock.get(v.id, 0),
            )
        )

    return CartRead(
        id=cart.id,
        token=cart.token,
        items=items,
        total_items=sum(i.cantidad for i in cart.items),
        subtotal=subtotal,
    )
