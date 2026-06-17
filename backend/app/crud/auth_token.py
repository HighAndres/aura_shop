"""Persistencia de refresh tokens: emisión, validación y revocación."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.auth_token import RefreshToken


def store(db: Session, *, jti: str, usuario_id: uuid.UUID, expires_at: datetime) -> None:
    db.add(RefreshToken(jti=jti, usuario_id=usuario_id, expires_at=expires_at))
    db.commit()


def is_valid(db: Session, jti: str) -> bool:
    rt = db.scalar(select(RefreshToken).where(RefreshToken.jti == jti))
    if rt is None or rt.revoked_at is not None:
        return False
    return rt.expires_at > datetime.now(timezone.utc)


def revoke(db: Session, jti: str) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.jti == jti, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    db.commit()


def revoke_all(db: Session, usuario_id: uuid.UUID) -> None:
    """Revoca todas las sesiones del usuario (p. ej. ante sospecha de robo)."""
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.usuario_id == usuario_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    db.commit()
