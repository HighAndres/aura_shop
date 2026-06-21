"""Endpoints de autenticación.

Flujos por contraseña y por correo (verificación, recuperación, enlace mágico).
Google OAuth se agregará cuando haya credenciales. El "envío" de correo en
desarrollo se registra en consola (ver app.core.email).
"""

import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core import email as email_service
from app.core.config import settings
from app.core.security import (
    EMAIL_VERIFY_TOKEN_TYPE,
    MAGIC_LINK_TOKEN_TYPE,
    PASSWORD_RESET_TOKEN_TYPE,
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_email_verify_token,
    create_magic_link_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    decode_token_of_type,
    verify_password,
)
from app.crud import user as crud_user
from app.db.session import get_db
from app.models.user import Usuario
from app.schemas.auth import (
    ChangePasswordRequest,
    EmailRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenRequest,
)
from app.schemas.token import RefreshRequest, Token
from app.schemas.user import UserCreate, UserPublicRead

router = APIRouter(prefix="/auth", tags=["auth"])

# Mensaje genérico para no revelar si un correo existe (evita enumeración).
_GENERIC_EMAIL_MSG = (
    "Si el correo está registrado, te enviamos un mensaje con las instrucciones."
)


def _tokens_for(user_id: uuid.UUID) -> Token:
    sub = str(user_id)
    return Token(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
    )


def _log_dev_token(token: str) -> None:
    """En desarrollo, imprime el token en los logs (nunca en la respuesta HTTP)."""
    if settings.DEBUG:
        import logging
        logging.getLogger(__name__).debug("DEV token: %s", token)


# --- Registro / login / refresh ---

@router.post(
    "/register",
    response_model=UserPublicRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar usuario con email y contraseña",
)
def register(data: UserCreate, db: Session = Depends(get_db)) -> UserPublicRead:
    if crud_user.get_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya está registrado",
        )
    user = crud_user.create(db, data, role_name=settings.DEFAULT_USER_ROLE)
    email_service.send_verification_email(
        user.email, create_email_verify_token(str(user.id))
    )
    return UserPublicRead.model_validate(user)


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
    crud_user.touch_last_login(db, user)
    return _tokens_for(user.id)


@router.post("/refresh", response_model=Token, summary="Renovar tokens")
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> Token:
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token inválido o expirado",
    )
    try:
        sub = decode_token_of_type(body.refresh_token, REFRESH_TOKEN_TYPE)
        user_id = uuid.UUID(sub)
    except (jwt.PyJWTError, ValueError):
        raise invalid

    user = crud_user.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise invalid
    # Rotación: nuevo par. (Revocación del anterior llegará con almacenamiento
    # de refresh tokens en la etapa de hardening.)
    return _tokens_for(user.id)


# --- Verificación de correo ---

@router.post(
    "/verify-email",
    response_model=MessageResponse,
    summary="Verificar correo con token",
)
def verify_email(body: TokenRequest, db: Session = Depends(get_db)) -> MessageResponse:
    try:
        sub = decode_token_of_type(body.token, EMAIL_VERIFY_TOKEN_TYPE)
        user_id = uuid.UUID(sub)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado",
        )
    user = crud_user.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido"
        )
    crud_user.mark_verified(db, user)
    return MessageResponse(message="Correo verificado correctamente.")


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    summary="Reenviar correo de verificación",
)
def resend_verification(
    body: EmailRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    user = crud_user.get_by_email(db, body.email)
    if user and not user.is_verified:
        token = create_email_verify_token(str(user.id))
        email_service.send_verification_email(user.email, token)
        _log_dev_token(token)
    return MessageResponse(message=_GENERIC_EMAIL_MSG)


# --- Recuperación / cambio de contraseña ---

@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Solicitar restablecer contraseña",
)
def forgot_password(
    body: EmailRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    user = crud_user.get_by_email(db, body.email)
    if user and user.is_active:
        token = create_password_reset_token(str(user.id), user.hashed_password)
        email_service.send_password_reset_email(user.email, token)
        _log_dev_token(token)
    return MessageResponse(message=_GENERIC_EMAIL_MSG)


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Restablecer contraseña con token",
)
def reset_password(
    body: ResetPasswordRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    try:
        payload = decode_token(body.token)
        if payload.get("type") != PASSWORD_RESET_TOKEN_TYPE:
            raise jwt.InvalidTokenError("Tipo incorrecto")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado",
        )
    user = crud_user.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido"
        )
    phash = payload.get("phash")
    if phash and user.hashed_password and not user.hashed_password.startswith(phash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este enlace ya fue utilizado",
        )
    crud_user.set_password(db, user, body.new_password)
    return MessageResponse(message="Contraseña actualizada. Ya puedes iniciar sesión.")


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Cambiar contraseña (autenticado)",
)
def change_password(
    body: ChangePasswordRequest,
    current_user: Usuario = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if current_user.hashed_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tienes contraseña establecida; usa 'olvidé mi contraseña'.",
        )
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual es incorrecta",
        )
    crud_user.set_password(db, current_user, body.new_password)
    return MessageResponse(message="Contraseña cambiada correctamente.")


# --- Enlace mágico (login sin contraseña) ---

@router.post(
    "/magic-link",
    response_model=MessageResponse,
    summary="Solicitar enlace mágico de acceso",
)
def request_magic_link(
    body: EmailRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    user = crud_user.get_by_email(db, body.email)
    if user and user.is_active:
        token = create_magic_link_token(str(user.id))
        email_service.send_magic_link_email(user.email, token)
        _log_dev_token(token)
    return MessageResponse(message=_GENERIC_EMAIL_MSG)


@router.post(
    "/magic-link/consume",
    response_model=Token,
    summary="Canjear enlace mágico por sesión",
)
def consume_magic_link(
    body: TokenRequest, db: Session = Depends(get_db)
) -> Token:
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Enlace inválido o expirado",
    )
    try:
        sub = decode_token_of_type(body.token, MAGIC_LINK_TOKEN_TYPE)
        user_id = uuid.UUID(sub)
    except (jwt.PyJWTError, ValueError):
        raise invalid
    user = crud_user.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise invalid
    # El enlace mágico prueba propiedad del correo: queda verificado.
    crud_user.mark_verified(db, user)
    crud_user.touch_last_login(db, user)
    return _tokens_for(user.id)
