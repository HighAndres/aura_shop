"""Dependencias compartidas de la API: sesión, usuario actual y RBAC."""

import uuid
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import ACCESS_TOKEN_TYPE, decode_token
from app.crud import user as crud_user
from app.db.session import get_db
from app.models.user import Usuario

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login"
)
# Variante que no falla si no hay token (para carrito de invitado, etc.).
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False
)

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="No se pudieron validar las credenciales",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    """Decodifica el access token y devuelve el usuario correspondiente."""
    try:
        payload = decode_token(token)
        if payload.get("type") != ACCESS_TOKEN_TYPE:
            raise _credentials_exc
        sub = payload.get("sub")
        if sub is None:
            raise _credentials_exc
        user_id = uuid.UUID(sub)
    except (jwt.PyJWTError, ValueError):
        raise _credentials_exc

    user = crud_user.get_by_id(db, user_id)
    if user is None:
        raise _credentials_exc
    return user


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> Usuario | None:
    """Devuelve el usuario si hay un access token válido; si no, None (no falla)."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != ACCESS_TOKEN_TYPE:
            return None
        sub = payload.get("sub")
        if sub is None:
            return None
        user_id = uuid.UUID(sub)
    except (jwt.PyJWTError, ValueError):
        return None
    return crud_user.get_by_id(db, user_id)


def get_current_active_user(
    current_user: Usuario = Depends(get_current_user),
) -> Usuario:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo"
        )
    return current_user


def _user_permission_codes(user: Usuario) -> set[str]:
    return {p.codigo for rol in user.roles for p in rol.permisos}


def require_permissions(*codes: str) -> Callable[[Usuario], Usuario]:
    """Dependencia que exige que el usuario tenga TODOS los permisos dados."""

    def checker(
        current_user: Usuario = Depends(get_current_active_user),
    ) -> Usuario:
        otorgados = _user_permission_codes(current_user)
        faltantes = set(codes) - otorgados
        if faltantes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permisos insuficientes: {', '.join(sorted(faltantes))}",
            )
        return current_user

    return checker


def require_roles(*names: str) -> Callable[[Usuario], Usuario]:
    """Dependencia que exige que el usuario tenga AL MENOS uno de los roles."""

    def checker(
        current_user: Usuario = Depends(get_current_active_user),
    ) -> Usuario:
        propios = {rol.nombre for rol in current_user.roles}
        if not propios.intersection(names):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Rol insuficiente",
            )
        return current_user

    return checker
