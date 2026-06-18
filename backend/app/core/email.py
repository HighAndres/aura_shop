"""Servicio de correo.

En desarrollo (EMAILS_ENABLED=false) NO envía nada: registra el mensaje y el
enlace en la consola del servidor. En producción se conectará SMTP real aquí.
"""

import logging

from app.core.config import settings

logger = logging.getLogger("aura.email")


def send_email(*, to: str, subject: str, body: str) -> None:
    """Envía un correo (o lo registra en consola si el envío está deshabilitado)."""
    if not settings.EMAILS_ENABLED:
        logger.warning(
            "[EMAIL-DEV] (no enviado) Para: %s | Asunto: %s\n%s",
            to,
            subject,
            body,
        )
        return
    # TODO: integrar SMTP real (smtplib / proveedor) cuando haya credenciales.
    raise NotImplementedError("Envío SMTP real aún no configurado")


def _link(path: str, token: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}{path}?token={token}"


def send_verification_email(to: str, token: str) -> None:
    link = _link("/verificar-correo", token)
    send_email(
        to=to,
        subject="Verifica tu correo en Aura Shop",
        body=f"Confirma tu cuenta entrando aquí:\n{link}",
    )


def send_password_reset_email(to: str, token: str) -> None:
    link = _link("/restablecer-contrasena", token)
    send_email(
        to=to,
        subject="Restablece tu contraseña de Aura Shop",
        body=f"Crea una nueva contraseña aquí:\n{link}",
    )


def send_magic_link_email(to: str, token: str) -> None:
    link = _link("/acceso", token)
    send_email(
        to=to,
        subject="Tu enlace de acceso a Aura Shop",
        body=f"Entra a tu cuenta con este enlace (15 min):\n{link}",
    )
