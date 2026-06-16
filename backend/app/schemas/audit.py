"""Schemas de la bitácora de auditoría."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditoriaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    usuario_id: uuid.UUID | None
    actor_email: str | None
    actor_rol: str | None
    accion: str
    entidad: str | None
    entidad_id: str | None
    descripcion: str
    cambios: dict[str, Any] | None
    ip: str | None
    created_at: datetime


class AuditoriaPage(BaseModel):
    items: list[AuditoriaRead]
    total: int
    limit: int
    offset: int
