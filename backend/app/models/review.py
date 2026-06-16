"""Reseñas/calificaciones de producto."""

from __future__ import annotations

import uuid

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Resena(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "resenas"
    __table_args__ = (
        # Una reseña por usuario y producto.
        UniqueConstraint("producto_id", "usuario_id", name="uq_resena_usuario"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_resena_rating"),
    )

    producto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # Nullable + SET NULL: si se borra el usuario, la reseña se conserva anónima.
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), index=True
    )

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    titulo: Mapped[str | None] = mapped_column(String(140))
    comentario: Mapped[str | None] = mapped_column(Text)
    # Moderación: solo se muestran las aprobadas en la tienda.
    aprobada: Mapped[bool] = mapped_column(default=False, nullable=False)

    producto = relationship("Producto", back_populates="resenas")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Resena {self.rating}★ producto={self.producto_id}>"
