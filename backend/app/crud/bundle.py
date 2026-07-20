"""Consultas y serialización de paquetes para la tienda pública."""

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bundle import Paquete, PaqueteItem
from app.models.catalog import Variante
from app.schemas.bundle import PaqueteItemPublic, PaquetePublic


class PaqueteSinVarianteError(Exception):
    """Un item del paquete no tiene ninguna variante activa que vender."""

    def __init__(self, paquete: Paquete, producto_nombre: str):
        self.paquete = paquete
        self.producto_nombre = producto_nombre
        super().__init__(
            f"El paquete {paquete.nombre} incluye {producto_nombre}, "
            "que no tiene presentaciones disponibles"
        )


def componentes(paquete: Paquete) -> list[tuple[Variante, int]]:
    """Resuelve cada item del paquete a una variante concreta y su cantidad.

    Si el item no fija variante, se usa la activa más barata del producto
    (la misma con la que se calcula el precio individual mostrado).
    """
    resultado: list[tuple[Variante, int]] = []
    for item in paquete.items:
        if item.variante is not None:
            # Variante fijada por el admin: si se desactivó, el paquete no se
            # vende (sustituirla en silencio cambiaría lo que compra el cliente).
            variante = item.variante if item.variante.activo else None
        else:
            activas = [v for v in item.producto.variantes if v.activo] if item.producto else []
            variante = min(activas, key=lambda v: v.precio) if activas else None
        if variante is None:
            nombre = item.producto.nombre if item.producto else "un producto"
            raise PaqueteSinVarianteError(paquete, nombre)
        resultado.append((variante, item.cantidad))
    return resultado


def precio_individual(items: list[PaqueteItem]) -> Decimal:
    """Suma de precios comprando cada artículo por separado.

    Si el item no fija variante, se toma la variante activa más barata
    del producto (mismo criterio que el "precio desde" del catálogo).
    """
    total = Decimal(0)
    for item in items:
        if item.variante:
            total += item.variante.precio * item.cantidad
        elif item.producto and item.producto.variantes:
            activas = [v.precio for v in item.producto.variantes if v.activo]
            if activas:
                total += min(activas) * item.cantidad
    return total


def list_paquetes_activos(
    db: Session, *, limit: int, offset: int
) -> tuple[list[Paquete], int]:
    filtro = Paquete.activo.is_(True)
    total = db.scalar(
        select(func.count()).select_from(Paquete).where(filtro)
    ) or 0
    items = db.scalars(
        select(Paquete)
        .where(filtro)
        .order_by(Paquete.destacado.desc(), Paquete.nombre)
        .offset(offset)
        .limit(limit)
    ).all()
    return list(items), total


def get_paquete_activo_by_slug(db: Session, slug: str) -> Paquete | None:
    return db.scalar(
        select(Paquete).where(Paquete.slug == slug, Paquete.activo.is_(True))
    )


def serialize_public(p: Paquete) -> PaquetePublic:
    precio_ind = precio_individual(p.items)
    return PaquetePublic(
        id=p.id,
        nombre=p.nombre,
        slug=p.slug,
        descripcion=p.descripcion,
        descripcion_corta=p.descripcion_corta,
        imagen_url=p.imagen_url,
        precio_paquete=p.precio_paquete,
        precio_individual=precio_ind,
        ahorro=precio_ind - p.precio_paquete,
        destacado=p.destacado,
        items=[
            PaqueteItemPublic(
                producto_nombre=item.producto.nombre if item.producto else "",
                producto_slug=item.producto.slug if item.producto else None,
                variante_sku=item.variante.sku if item.variante else None,
                cantidad=item.cantidad,
            )
            for item in p.items
        ],
    )
