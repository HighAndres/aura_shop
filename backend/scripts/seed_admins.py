"""Seed de usuarios del personal para desarrollo (superadmin, admin, vendedor).

Idempotente: crea o actualiza la contraseña y asigna el rol. SOLO para
desarrollo/pruebas — NO usar estas credenciales en producción.

Ejecutar (tras seed_rbac):  python scripts/seed_admins.py
"""

from sqlalchemy import select

from app.crud import user as cu
from app.db.session import SessionLocal
from app.models.rbac import Rol
from app.schemas.user import UserCreate

# (email, contraseña, nombre, rol)
USUARIOS = [
    ("super@aura.mx", "super12345", "Super Admin", "superadmin"),
    ("admin@aura.mx", "admin12345", "Administrador", "administrador"),
    ("vendedor@aura.mx", "vendedor12345", "Vendedor", "vendedor"),
]


def seed() -> None:
    db = SessionLocal()
    try:
        for email, pw, nombre, rol_nombre in USUARIOS:
            rol = db.scalar(select(Rol).where(Rol.nombre == rol_nombre))
            if rol is None:
                print(f"  (omitido) falta el rol '{rol_nombre}'; corre seed_rbac primero")
                continue
            user = cu.get_by_email(db, email)
            if user is None:
                user = cu.create(
                    db,
                    UserCreate(email=email, password=pw, nombre_completo=nombre),
                    role_name=rol_nombre,
                )
            else:
                cu.set_password(db, user, pw)
            if rol not in user.roles:
                user.roles.append(rol)
                db.add(user)
                db.commit()
            cu.mark_verified(db, user)
            print(f"  {email}  /  {pw}   -> {rol_nombre}")
        print("Seed de personal OK.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
