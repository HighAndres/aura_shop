"""Endpoints de autenticación.

Flujos por contraseña y por correo (verificación, recuperación, enlace mágico).
Google OAuth se agregará cuando haya credenciales. El "envío" de correo en
desarrollo se registra en consola (ver app.core.email).
"""

import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core import email as email_service
from app.core.config import settings
from app.core.limiter import limiter
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
from app.crud import auth_token as crud_token
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
from app.schemas.token import AccessToken
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

# Mensaje genérico para no revelar si un correo existe (evita enumeración).
_GENERIC_EMAIL_MSG = (
    "Si el correo está registrado, te enviamos un mensaje con las instrucciones."
)

# Cookie del refresh token: httpOnly, alcance solo a /auth, Secure en prod.
REFRESH_COOKIE = "aura_refresh"
_COOKIE_PATH = f"{settings.API_V1_PREFIX}/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        path=_COOKIE_PATH,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=_COOKIE_PATH)


def _issue_session(
    db: Session, response: Response, user_id: uuid.UUID
) -> AccessToken:
    """Emite access token (body) y refresh token persistido (cookie httpOnly)."""
    sub = str(user_id)
    refresh, jti, expira = create_refresh_token(sub)
    crud_token.store(db, jti=jti, usuario_id=user_id, expires_at=expira)
    _set_refresh_cookie(response, refresh)
    return AccessToken(access_token=create_access_token(sub))


def _dev_token(token: str) -> str | None:
    """Expone el token en la respuesta SOLO en desarrollo, para pruebas.

    Atado a ENVIRONMENT (no a DEBUG) para que un DEBUG mal puesto en producción
    no filtre tokens de verificación/reset.
    """
    return token if settings.ENVIRONMENT == "development" else None


# --- Registro / login / refresh ---

@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar usuario con email y contraseña",
)
@limiter.limit("5/minute")
def register(
    data: UserCreate, request: Request, db: Session = Depends(get_db)
) -> UserRead:
    if crud_user.get_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya está registrado",
        )
    user = crud_user.create(db, data, role_name=settings.DEFAULT_USER_ROLE)
    # Enviar verificación de correo (en dev se registra en consola).
    email_service.send_verification_email(
        user.email, create_email_verify_token(str(user.id))
    )
    return UserRead.model_validate(user)


@router.post("/login", response_model=AccessToken, summary="Iniciar sesión")
@limiter.limit("10/minute")
def login(
    request: Request,
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> AccessToken:
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
    return _issue_session(db, response, user.id)


@router.post("/refresh", response_model=AccessToken, summary="Renovar sesión")
def refresh(
    request: Request, response: Response, db: Session = Depends(get_db)
) -> AccessToken:
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesión inválida o expirada",
    )
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise invalid
    try:
        payload = decode_token(token)
        if payload.get("type") != REFRESH_TOKEN_TYPE:
            raise invalid
        jti = payload.get("jti")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise invalid

    if not jti or not crud_token.is_valid(db, jti):
        raise invalid
    user = crud_user.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise invalid

    # Rotación: revoca el refresh actual y emite uno nuevo.
    crud_token.revoke(db, jti)
    return _issue_session(db, response, user.id)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cerrar sesión (revoca el refresh)",
)
def logout(
    request: Request, response: Response, db: Session = Depends(get_db)
) -> None:
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        try:
            jti = decode_token(token).get("jti")
            if jti:
                crud_token.revoke(db, jti)
        except jwt.PyJWTError:
            pass
    _clear_refresh_cookie(response)


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
    dev = None
    if user and not user.is_verified:
        token = create_email_verify_token(str(user.id))
        email_service.send_verification_email(user.email, token)
        dev = _dev_token(token)
    return MessageResponse(message=_GENERIC_EMAIL_MSG, dev_token=dev)


# --- Recuperación / cambio de contraseña ---

@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Solicitar restablecer contraseña",
)
@limiter.limit("5/minute")
def forgot_password(
    body: EmailRequest, request: Request, db: Session = Depends(get_db)
) -> MessageResponse:
    user = crud_user.get_by_email(db, body.email)
    dev = None
    if user and user.is_active:
        token = create_password_reset_token(str(user.id))
        email_service.send_password_reset_email(user.email, token)
        dev = _dev_token(token)
    return MessageResponse(message=_GENERIC_EMAIL_MSG, dev_token=dev)


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Restablecer contraseña con token",
)
def reset_password(
    body: ResetPasswordRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    try:
        sub = decode_token_of_type(body.token, PASSWORD_RESET_TOKEN_TYPE)
        user_id = uuid.UUID(sub)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado",
        )
    user = crud_user.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido"
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
@limiter.limit("5/minute")
def request_magic_link(
    body: EmailRequest, request: Request, db: Session = Depends(get_db)
) -> MessageResponse:
    user = crud_user.get_by_email(db, body.email)
    dev = None
    if user and user.is_active:
        token = create_magic_link_token(str(user.id))
        email_service.send_magic_link_email(user.email, token)
        dev = _dev_token(token)
    return MessageResponse(message=_GENERIC_EMAIL_MSG, dev_token=dev)


@router.post(
    "/magic-link/consume",
    response_model=AccessToken,
    summary="Canjear enlace mágico por sesión",
)
def consume_magic_link(
    body: TokenRequest, response: Response, db: Session = Depends(get_db)
) -> AccessToken:
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
    return _issue_session(db, response, user.id)
