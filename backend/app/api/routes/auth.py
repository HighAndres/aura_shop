"""Endpoints de autenticación: registro, login y refresh (email + contraseña).

Google OAuth, enlace mágico y verificación por correo se agregan después.
"""

import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.crud import user as crud_user
from app.db.session import get_db
from app.schemas.token import RefreshRequest, Token
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens_for(user_id: uuid.UUID) -> Token:
    sub = str(user_id)
    return Token(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
    )


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar usuario con email y contraseña",
)
def register(data: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    if crud_user.get_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya está registrado",
        )
    user = crud_user.create(db, data, role_name=settings.DEFAULT_USER_ROLE)
    return UserRead.model_validate(user)


@router.post("/login", response_model=Token, summary="Iniciar sesión")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    # OAuth2PasswordRequestForm usa "username"; aquí es el email.
    user = crud_user.authenticate(db, form.username, form.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo"
        )
    return _tokens_for(user.id)


@router.post("/refresh", response_model=Token, summary="Renovar tokens")
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> Token:
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token inválido o expirado",
    )
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != REFRESH_TOKEN_TYPE:
            raise invalid
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise invalid

    user = crud_user.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise invalid
    # Rotación: se emite un nuevo par. (Revocación del anterior llegará con
    # almacenamiento de refresh tokens en la etapa de hardening.)
    return _tokens_for(user.id)
