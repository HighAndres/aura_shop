"""Schemas de los flujos de autenticación por correo y contraseña."""

from pydantic import BaseModel, EmailStr, Field


class MessageResponse(BaseModel):
    """Respuesta genérica. `dev_token` solo se rellena en modo desarrollo."""

    message: str
    dev_token: str | None = None


class EmailRequest(BaseModel):
    email: EmailStr


class TokenRequest(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
