"""Utilidades de seguridad: hashing de contraseñas y tokens JWT.

OAuth (Google) y enlaces mágicos se agregarán en la siguiente sub-etapa.
"""

from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core.config import settings

# bcrypt fijado en 4.0.1 (ver requirements.txt) por compatibilidad con passlib.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Tipos de token (claim "type"): access/refresh y tokens de un solo uso (correo).
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"
EMAIL_VERIFY_TOKEN_TYPE = "email_verify"
PASSWORD_RESET_TOKEN_TYPE = "password_reset"
MAGIC_LINK_TOKEN_TYPE = "magic_link"


def hash_password(password: str) -> str:
    """Devuelve el hash bcrypt de una contraseña en claro."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña en claro contra su hash almacenado."""
    return pwd_context.verify(plain_password, hashed_password)


def _create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,           # id del usuario (UUID en str)
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str) -> str:
    return _create_token(
        subject,
        ACCESS_TOKEN_TYPE,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: str) -> str:
    return _create_token(
        subject,
        REFRESH_TOKEN_TYPE,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_email_verify_token(subject: str) -> str:
    return _create_token(
        subject,
        EMAIL_VERIFY_TOKEN_TYPE,
        timedelta(hours=settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS),
    )


def create_password_reset_token(subject: str, pwd_hash: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": PASSWORD_RESET_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
    }
    if pwd_hash:
        payload["phash"] = pwd_hash[:16]
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_magic_link_token(subject: str) -> str:
    return _create_token(
        subject,
        MAGIC_LINK_TOKEN_TYPE,
        timedelta(minutes=settings.MAGIC_LINK_TOKEN_EXPIRE_MINUTES),
    )


def decode_token(token: str) -> dict:
    """Decodifica y valida firma/expiración. Lanza jwt.PyJWTError si es inválido."""
    return jwt.decode(
        token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )


def decode_token_of_type(token: str, expected_type: str) -> str:
    """Valida el token y que sea del tipo esperado; devuelve el 'sub'.

    Lanza jwt.PyJWTError (o ValueError) si es inválido, expiró o el tipo no coincide.
    """
    payload = decode_token(token)
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Tipo de token incorrecto")
    sub = payload.get("sub")
    if not sub:
        raise jwt.InvalidTokenError("Token sin sujeto")
    return sub
