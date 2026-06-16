"""Endpoint de la bitácora de auditoría (solo superadmin: permiso bitacora.leer)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.crud import audit as crud
from app.db.session import get_db
from app.schemas.audit import AuditoriaPage, AuditoriaRead

router = APIRouter(prefix="/audit", tags=["auditoría"])


@router.get(
    "",
    response_model=AuditoriaPage,
    summary="Ver bitácora de auditoría",
    dependencies=[Depends(require_permissions("bitacora.leer"))],
)
def listar_bitacora(
    db: Session = Depends(get_db),
    actor: str | None = Query(default=None, description="filtra por correo del actor"),
    accion: str | None = Query(default=None),
    entidad: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AuditoriaPage:
    items, total = crud.list_auditoria(
        db, actor=actor, accion=accion, entidad=entidad, limit=limit, offset=offset
    )
    return AuditoriaPage(
        items=[AuditoriaRead.model_validate(a) for a in items],
        total=total,
        limit=limit,
        offset=offset,
    )
