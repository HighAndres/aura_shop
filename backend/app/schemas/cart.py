"""Schemas del carrito."""

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field


class CartItemIn(BaseModel):
    sku: str
    cantidad: int = Field(default=1, ge=1, le=999)


class CartItemUpdate(BaseModel):
    cantidad: int = Field(ge=1, le=999)


class CartItemRead(BaseModel):
    variante_id: uuid.UUID
    sku: str
    nombre: str
    producto_slug: str
    imagen: str | None = None
    precio_unitario: Decimal
    cantidad: int
    subtotal: Decimal
    disponible: int


class CartRead(BaseModel):
    id: uuid.UUID | None = None
    # Token del carrito de invitado (el cliente debe guardarlo y reenviarlo).
    token: str | None = None
    items: list[CartItemRead] = []
    total_items: int = 0
    subtotal: Decimal = Decimal("0.00")


class MergeRequest(BaseModel):
    token: str
