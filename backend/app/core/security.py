"""Utilidades de seguridad: hashing de contraseñas.

JWT (access/refresh), OAuth y enlaces mágicos se agregarán en la etapa de auth.
"""

from passlib.context import CryptContext

# bcrypt fijado en 4.0.1 (ver requirements.txt) por compatibilidad con passlib.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Devuelve el hash bcrypt de una contraseña en claro."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña en claro contra su hash almacenado."""
    return pwd_context.verify(plain_password, hashed_password)
