"""Servicio de bitácora: registra acciones del personal en la tabla auditoria."""

from __future__ import annotations

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit import Auditoria
from app.models.user import Usuario


def registrar(
    db: Session,
    *,
    actor: Usuario | None,
    accion: str,
    descripcion: str,
    entidad: str | None = None,
    entidad_id: str | None = None,
    cambios: dict | None = None,
    request: Request | None = None,
) -> None:
    """Crea un registro de auditoría (best-effort; no rompe la acción si falla)."""
    ip = None
    user_agent = None
    if request is not None:
        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    actor_rol = (
        ", ".join(r.nombre for r in actor.roles) if actor and actor.roles else None
    )

    registro = Auditoria(
        usuario_id=actor.id if actor else None,
        actor_email=actor.email if actor else None,
        actor_rol=actor_rol,
        accion=accion,
        entidad=entidad,
        entidad_id=entidad_id,
        descripcion=descripcion,
        cambios=cambios,
        ip=ip,
        user_agent=user_agent,
    )
    try:
        db.add(registro)
        db.commit()
    except Exception:
        db.rollback()
