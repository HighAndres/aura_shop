"""Schemas de checkout y pedido."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class CheckoutIn(BaseModel):
    """Datos para convertir el carrito en pedido.

    `email` es obligatorio para invitados; si el usuario está logueado se usa
    el de su cuenta cuando se omite. Los datos CFDI son opcionales salvo que
    `requiere_factura` sea verdadero.
    """

    email: EmailStr | None = None
    nombre_contacto: str = Field(min_length=1, max_length=255)
    telefono: str | None = Field(default=None, max_length=32)

    direccion_calle: str | None = Field(default=None, max_length=255)
    direccion_ciudad: str | None = Field(default=None, max_length=120)
    direccion_estado: str | None = Field(default=None, max_length=120)
    direccion_cp: str | None = Field(default=None, max_length=10)
    notas: str | None = None

    requiere_factura: bool = False
    rfc: str | None = Field(default=None, max_length=13)
    razon_social: str | None = Field(default=None, max_length=255)
    regimen_fiscal: str | None = Field(default=None, max_length=10)
    uso_cfdi: str | None = Field(default=None, max_length=10)
    cp_fiscal: str | None = Field(default=None, max_length=10)

    @model_validator(mode="after")
    def _validar_cfdi(self) -> "CheckoutIn":
        if self.requiere_factura and not (self.rfc and self.regimen_fiscal and self.uso_cfdi):
            raise ValueError(
                "Para facturar se requieren al menos rfc, regimen_fiscal y uso_cfdi"
            )
        return self


class PedidoItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sku: str
    nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class PedidoEstadoHistorialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    estado_anterior: str | None = None
    estado_nuevo: str
    origen: str
    nota: str | None = None
    referencia: str | None = None
    actor_nombre: str | None = None
    created_at: datetime


class PedidoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    numero: str
    email: EmailStr
    estado: str
    nombre_contacto: str
    telefono: str | None = None
    direccion_calle: str | None = None
    direccion_ciudad: str | None = None
    direccion_estado: str | None = None
    direccion_cp: str | None = None
    requiere_factura: bool
    rfc: str | None = None
    subtotal: Decimal
    envio: Decimal
    total: Decimal
    asignado_a: uuid.UUID | None = None
    asignado_a_nombre: str | None = None
    items: list[PedidoItemRead] = []
    created_at: datetime


class PedidoDetalleRead(PedidoRead):
    """Pedido con su línea de tiempo. Solo para el detalle: en el listado el
    historial multiplicaría el tamaño de la respuesta sin que nadie lo mire.
    """

    historial: list[PedidoEstadoHistorialRead] = []
