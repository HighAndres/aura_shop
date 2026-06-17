"""Schemas de reportes."""

from decimal import Decimal

from pydantic import BaseModel


class VentasResumen(BaseModel):
    num_pedidos: int
    ingresos: Decimal
    ticket_promedio: Decimal
    por_estado: dict[str, int]


class TopProducto(BaseModel):
    sku: str
    nombre: str
    cantidad: int
    ingreso: Decimal


class StockBajoItem(BaseModel):
    sku: str
    producto: str
    disponible: int
