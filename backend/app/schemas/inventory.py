"""Schemas de inventario (entrada/salida de la API admin)."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.inventory import TipoMovimiento


class AlmacenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    codigo: str
    activo: bool


class MovimientoCreate(BaseModel):
    """Registra un movimiento de inventario.

    `cantidad` con signo: positiva aumenta stock, negativa lo reduce.
    Coherencia: entrada > 0, salida < 0, ajuste ≠ 0.
    Si se indican datos de lote, se crea/reutiliza el lote de esa variante.
    """

    sku: str
    almacen: str = Field(description="código del almacén")
    tipo: TipoMovimiento
    cantidad: int = Field(description="con signo; ≠ 0")
    lote_codigo: str | None = None
    lote_caducidad: date | None = None
    referencia: str | None = Field(default=None, max_length=120)
    nota: str | None = Field(default=None, max_length=255)


class MovimientoRead(BaseModel):
    id: uuid.UUID
    sku: str
    almacen: str
    tipo: str
    cantidad: int
    lote: str | None = None
    referencia: str | None = None
    nota: str | None = None
    fecha: datetime


class StockItem(BaseModel):
    """Stock disponible agregado de una variante (opcionalmente por almacén)."""

    sku: str
    producto: str
    almacen: str | None = None
    disponible: int
