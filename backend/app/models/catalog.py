"""Modelos de catálogo: marcas, categorías, productos, variantes (SKU) y atributos.

Odoo es la fuente de verdad: estos registros se sincronizan DESDE Odoo
(de ahí OdooSyncMixin). Estructura de variantes/atributos al estilo
product.template / product.product / product.attribute de Odoo:

    Producto (template) ──< Variante (SKU) >──M2M── ValorAtributo >── Atributo
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, OdooSyncMixin, TimestampMixin, UUIDPKMixin

# --- M2M Variante <-> ValorAtributo ---
variante_valores = Table(
    "variante_valores",
    Base.metadata,
    Column(
        "variante_id",
        ForeignKey("variantes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "valor_atributo_id",
        ForeignKey("valores_atributo.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Marca(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    __tablename__ = "marcas"

    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(140), unique=True, index=True, nullable=False
    )
    descripcion: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    productos: Mapped[list[Producto]] = relationship(back_populates="marca")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Marca {self.nombre}>"


class Categoria(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    __tablename__ = "categorias"

    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(140), unique=True, index=True, nullable=False
    )
    descripcion: Mapped[str | None] = mapped_column(Text)
    # Jerarquía opcional (subcategorías).
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categorias.id", ondelete="SET NULL")
    )
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    parent: Mapped[Categoria | None] = relationship(
        remote_side="Categoria.id", back_populates="hijos"
    )
    hijos: Mapped[list[Categoria]] = relationship(back_populates="parent")
    productos: Mapped[list[Producto]] = relationship(back_populates="categoria")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Categoria {self.nombre}>"


class Producto(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    __tablename__ = "productos"

    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(280), unique=True, index=True, nullable=False
    )
    descripcion: Mapped[str | None] = mapped_column(Text)
    descripcion_corta: Mapped[str | None] = mapped_column(String(500))

    marca_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("marcas.id", ondelete="SET NULL"), index=True
    )
    categoria_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categorias.id", ondelete="SET NULL"), index=True
    )

    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    destacado: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    marca: Mapped[Marca | None] = relationship(
        back_populates="productos", lazy="selectin"
    )
    categoria: Mapped[Categoria | None] = relationship(
        back_populates="productos", lazy="selectin"
    )
    variantes: Mapped[list[Variante]] = relationship(
        back_populates="producto",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Variante.sku",
    )
    imagenes: Mapped[list[ProductoImagen]] = relationship(
        back_populates="producto",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProductoImagen.orden",
    )
    resenas: Mapped[list[Resena]] = relationship(  # noqa: F821
        back_populates="producto", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Producto {self.nombre}>"


class Variante(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    """SKU concreto (tono/tamaño/aroma). El precio y el stock viven aquí."""

    __tablename__ = "variantes"

    producto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    sku: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    nombre: Mapped[str | None] = mapped_column(String(255))
    codigo_barras: Mapped[str | None] = mapped_column(String(64), index=True)

    # Precios en MXN. Odoo es la fuente de verdad.
    precio: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=0, nullable=False
    )
    precio_comparativo: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    peso_gramos: Mapped[int | None] = mapped_column(Integer)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    producto: Mapped[Producto] = relationship(back_populates="variantes")
    valores: Mapped[list[ValorAtributo]] = relationship(
        secondary=variante_valores, lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Variante {self.sku}>"


class Atributo(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    """Eje de variación: Tono, Tamaño, Aroma... (mapea a product.attribute)."""

    __tablename__ = "atributos"

    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )

    valores: Mapped[list[ValorAtributo]] = relationship(
        back_populates="atributo",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Atributo {self.nombre}>"


class ValorAtributo(UUIDPKMixin, TimestampMixin, OdooSyncMixin, Base):
    """Valor concreto de un atributo: 'Rojo', '30 ml', 'Lavanda'."""

    __tablename__ = "valores_atributo"
    __table_args__ = (
        UniqueConstraint("atributo_id", "slug", name="uq_valor_atributo_slug"),
    )

    atributo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("atributos.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    valor: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False)

    atributo: Mapped[Atributo] = relationship(
        back_populates="valores", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ValorAtributo {self.valor}>"


class ProductoImagen(UUIDPKMixin, TimestampMixin, Base):
    """Imagen del producto. Por ahora solo URL (Odoo o CDN); sin subida."""

    __tablename__ = "producto_imagenes"

    producto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    alt: Mapped[str | None] = mapped_column(String(255))
    orden: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    es_principal: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    producto: Mapped[Producto] = relationship(back_populates="imagenes")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ProductoImagen {self.url}>"
