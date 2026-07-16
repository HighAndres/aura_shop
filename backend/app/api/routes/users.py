"""Endpoints de usuarios."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    require_permissions,
    user_permission_codes,
)
from app.core import audit
from app.db.session import get_db
from app.models.user import Usuario
from app.schemas.user import UserMeRead, UserProfileUpdate, UserRead

router = APIRouter(prefix="/users", tags=["users"])

STAFF_ROLES = {"superadmin", "administrador", "vendedor"}


def _me_con_permisos(user: Usuario) -> UserMeRead:
    data = UserMeRead.model_validate(user)
    # A los clientes se les oculta la estructura interna de roles/permisos:
    # la tienda no gatea por ellos y no tienen por qué conocerla.
    if not any(r in STAFF_ROLES for r in data.roles):
        data.roles = []
        data.permisos = []
    else:
        data.permisos = sorted(user_permission_codes(user))
    return data


@router.get("/me", response_model=UserMeRead, summary="Perfil del usuario actual")
def read_me(
    current_user: Usuario = Depends(get_current_active_user),
) -> UserMeRead:
    return _me_con_permisos(current_user)


@router.put(
    "/me",
    response_model=UserMeRead,
    summary="Editar el perfil propio",
)
def update_me(
    body: UserProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("perfil.editar_propio")),
) -> UserMeRead:
    # exclude_unset: quien manda solo {"telefono": "..."} no debe borrar el
    # resto de su perfil por omisión.
    cambios = body.model_dump(exclude_unset=True)
    for campo, valor in cambios.items():
        setattr(current_user, campo, valor)

    db.commit()
    db.refresh(current_user)

    audit.registrar(
        db,
        actor=current_user,
        accion="perfil.editar_propio",
        descripcion="Perfil propio actualizado",
        entidad="usuario",
        entidad_id=str(current_user.id),
        cambios=cambios,
        request=request,
    )

    return _me_con_permisos(current_user)


@router.get(
    "",
    response_model=list[UserRead],
    summary="Listar usuarios (requiere permiso usuarios.leer)",
    dependencies=[Depends(require_permissions("usuarios.leer"))],
)
def list_users(db: Session = Depends(get_db)) -> list[UserRead]:
    usuarios = db.scalars(select(Usuario).order_by(Usuario.created_at)).all()
    return [UserRead.model_validate(u) for u in usuarios]
