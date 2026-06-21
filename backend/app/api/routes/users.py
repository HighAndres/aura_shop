"""Endpoints de usuarios."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_permissions
from app.db.session import get_db
from app.models.user import Usuario
from app.schemas.user import UserPublicRead, UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublicRead, summary="Perfil del usuario actual")
def read_me(
    current_user: Usuario = Depends(get_current_active_user),
) -> UserPublicRead:
    return UserPublicRead.model_validate(current_user)


@router.get(
    "",
    response_model=list[UserRead],
    summary="Listar usuarios (requiere permiso usuarios.leer)",
    dependencies=[Depends(require_permissions("usuarios.leer"))],
)
def list_users(db: Session = Depends(get_db)) -> list[UserRead]:
    usuarios = db.scalars(select(Usuario).order_by(Usuario.created_at)).all()
    return [UserRead.model_validate(u) for u in usuarios]
