"""Crea (o actualiza) un usuario con un rol, leyendo de variables de entorno.

Pensado para producción (no interactivo). Ejemplo:
    AURA_EMAIL=tu@correo.com AURA_PASSWORD='clave-fuerte' AURA_ROL=superadmin \
        python scripts/crear_usuario.py
"""

import os
import sys

from sqlalchemy import select

from app.crud import user as cu
from app.db.session import SessionLocal
from app.models.rbac import Rol
from app.schemas.user import UserCreate

email = os.environ.get("AURA_EMAIL")
password = os.environ.get("AURA_PASSWORD")
rol_nombre = os.environ.get("AURA_ROL", "superadmin")

if not email or not password:
    sys.exit("Define AURA_EMAIL y AURA_PASSWORD en el entorno.")

db = SessionLocal()
try:
    rol = db.scalar(select(Rol).where(Rol.nombre == rol_nombre))
    if rol is None:
        sys.exit(f"No existe el rol '{rol_nombre}'. Corre seed_rbac primero.")
    user = cu.get_by_email(db, email)
    if user is None:
        user = cu.create(db, UserCreate(email=email, password=password), role_name=rol_nombre)
    else:
        cu.set_password(db, user, password)
    if rol not in user.roles:
        user.roles.append(rol)
        db.add(user)
        db.commit()
    cu.mark_verified(db, user)
    print(f"Usuario {email} listo con rol {rol_nombre}.")
finally:
    db.close()
