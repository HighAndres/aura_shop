"""Endpoints administrativos de usuarios: CRUD y gestión de roles."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.core import audit
from app.core.security import hash_password
from app.db.session import get_db
from app.models.rbac import Rol
from app.models.user import Usuario
from app.schemas.user import UserRead

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


# ── Schemas ────────────────────────────────────────────────────────────

class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    nombre_completo: str | None = Field(default=None, max_length=255)
    telefono: str | None = Field(default=None, max_length=32)
    roles: list[str] = []


class AdminUserUpdate(BaseModel):
    nombre_completo: str | None = Field(default=None, max_length=255)
    telefono: str | None = Field(default=None, max_length=32)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool | None = None
    is_verified: bool | None = None
    roles: list[str] | None = None


class AdminUserPage(BaseModel):
    items: list[UserRead]
    total: int
    limit: int
    offset: int


class RolRead(BaseModel):
    nombre: str
    descripcion: str | None = None


# ── Endpoints ──────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=AdminUserPage,
    summary="Listar usuarios (paginado)",
    dependencies=[Depends(require_permissions("usuarios.leer"))],
)
def listar_usuarios(
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
    rol: str | None = Query(default=None),
    activo: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminUserPage:
    query = select(Usuario)
    count_q = select(func.count()).select_from(Usuario)

    if q:
        filtro = Usuario.email.ilike(f"%{q}%") | Usuario.nombre_completo.ilike(f"%{q}%")
        query = query.where(filtro)
        count_q = count_q.where(filtro)
    if activo is not None:
        query = query.where(Usuario.is_active == activo)
        count_q = count_q.where(Usuario.is_active == activo)
    if rol:
        query = query.where(Usuario.roles.any(Rol.nombre == rol))
        count_q = count_q.where(Usuario.roles.any(Rol.nombre == rol))

    total = db.scalar(count_q) or 0
    items = db.scalars(
        query.order_by(Usuario.created_at.desc()).offset(offset).limit(limit)
    ).all()

    return AdminUserPage(
        items=[UserRead.model_validate(u) for u in items],
        total=total, limit=limit, offset=offset,
    )


@router.get(
    "/roles",
    response_model=list[RolRead],
    summary="Listar roles disponibles",
    dependencies=[Depends(require_permissions("usuarios.leer"))],
)
def listar_roles(db: Session = Depends(get_db)) -> list[RolRead]:
    roles = db.scalars(select(Rol).order_by(Rol.nombre)).all()
    return [RolRead(nombre=r.nombre, descripcion=r.descripcion) for r in roles]


@router.post(
    "",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario desde admin",
)
def crear_usuario(
    body: AdminUserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("usuarios.crear")),
) -> UserRead:
    if db.scalar(select(Usuario).where(Usuario.email == body.email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Email ya registrado: {body.email}")

    user = Usuario(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        nombre_completo=body.nombre_completo,
        telefono=body.telefono,
        is_verified=True,
    )

    if body.roles:
        roles = db.scalars(select(Rol).where(Rol.nombre.in_(body.roles))).all()
        user.roles = list(roles)

    db.add(user)
    db.commit()
    db.refresh(user)

    audit.registrar(
        db, actor=current_user, accion="usuarios.crear",
        descripcion=f"Usuario creado: {user.email}",
        entidad="usuario", entidad_id=str(user.id),
        cambios={"email": user.email, "roles": body.roles},
        request=request,
    )
    return UserRead.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=UserRead,
    summary="Editar usuario",
)
def editar_usuario(
    user_id: str,
    body: AdminUserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("usuarios.editar")),
) -> UserRead:
    user = db.get(Usuario, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    changes = body.model_dump(exclude_unset=True)

    if "nombre_completo" in changes:
        user.nombre_completo = changes["nombre_completo"]
    if "telefono" in changes:
        user.telefono = changes["telefono"]
    if "password" in changes and body.password:
        user.hashed_password = hash_password(body.password)
        del changes["password"]
    if "is_active" in changes:
        user.is_active = changes["is_active"]
    if "is_verified" in changes:
        user.is_verified = changes["is_verified"]

    if "roles" in changes and body.roles is not None:
        roles = db.scalars(select(Rol).where(Rol.nombre.in_(body.roles))).all()
        user.roles = list(roles)

    db.commit()
    db.refresh(user)

    audit.registrar(
        db, actor=current_user, accion="usuarios.editar",
        descripcion=f"Usuario editado: {user.email}",
        entidad="usuario", entidad_id=str(user.id),
        cambios=changes, request=request,
    )
    return UserRead.model_validate(user)


@router.patch(
    "/{user_id}/toggle",
    response_model=UserRead,
    summary="Activar/desactivar usuario",
)
def toggle_usuario(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("usuarios.editar")),
) -> UserRead:
    user = db.get(Usuario, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    if user.id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes desactivarte a ti mismo")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)

    audit.registrar(
        db, actor=current_user, accion="usuarios.editar",
        descripcion=f"Usuario {'activado' if user.is_active else 'desactivado'}: {user.email}",
        entidad="usuario", entidad_id=str(user.id),
        cambios={"is_active": user.is_active}, request=request,
    )
    return UserRead.model_validate(user)
