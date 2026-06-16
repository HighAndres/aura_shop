"""Operaciones de base de datos para usuarios y autenticación."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.rbac import Rol
from app.models.user import Usuario
from app.schemas.user import UserCreate


def get_by_id(db: Session, user_id: uuid.UUID) -> Usuario | None:
    return db.get(Usuario, user_id)


def get_by_email(db: Session, email: str) -> Usuario | None:
    # Email normalizado a minúsculas para evitar duplicados por mayúsculas.
    return db.scalar(select(Usuario).where(Usuario.email == email.lower()))


def create(db: Session, data: UserCreate, *, role_name: str) -> Usuario:
    """Crea un usuario con contraseña y le asigna un rol por nombre."""
    user = Usuario(
        email=data.email.lower(),
        hashed_password=hash_password(data.password),
        nombre_completo=data.nombre_completo,
        telefono=data.telefono,
    )

    rol = db.scalar(select(Rol).where(Rol.nombre == role_name))
    if rol is not None:
        user.roles.append(rol)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> Usuario | None:
    """Devuelve el usuario si email+contraseña son válidos; si no, None."""
    user = get_by_email(db, email)
    if user is None or user.hashed_password is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
