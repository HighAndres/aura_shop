"""Consultas de la bitácora."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit import Auditoria


def list_auditoria(
    db: Session,
    *,
    actor: str | None = None,
    accion: str | None = None,
    entidad: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Auditoria], int]:
    stmt = select(Auditoria)
    if actor:
        stmt = stmt.where(Auditoria.actor_email.ilike(f"%{actor}%"))
    if accion:
        stmt = stmt.where(Auditoria.accion == accion)
    if entidad:
        stmt = stmt.where(Auditoria.entidad == entidad)

    total = db.scalar(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    )
    items = list(
        db.scalars(
            stmt.order_by(Auditoria.created_at.desc()).limit(limit).offset(offset)
        ).all()
    )
    return items, total or 0
