"""Seed idempotente de RBAC: crea roles base y catálogo inicial de permisos.

Ejecutar DESPUÉS de aplicar las migraciones:
    python scripts/seed_rbac.py

Es idempotente: si ya existen, no duplica; solo agrega lo que falte.
Ajusta PERMISOS y ROLES según evolucione el negocio.
"""

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.rbac import Permiso, Rol

# Catálogo inicial de permisos: "recurso.accion".
PERMISOS: dict[str, str] = {
    "usuarios.leer": "Ver usuarios",
    "usuarios.crear": "Crear usuarios",
    "usuarios.editar": "Editar usuarios",
    "usuarios.eliminar": "Eliminar usuarios",
    "roles.gestionar": "Gestionar roles y permisos",
    "productos.leer": "Ver catálogo",
    "productos.crear": "Crear productos",
    "productos.editar": "Editar productos",
    "productos.eliminar": "Eliminar productos",
    "inventario.leer": "Ver inventario",
    "inventario.ajustar": "Registrar movimientos de inventario",
    "pedidos.leer": "Ver todos los pedidos",
    "pedidos.leer_propios": "Ver pedidos propios",
    "pedidos.crear": "Crear pedidos",
    "pedidos.editar": "Editar pedidos",
    "pedidos.cancelar": "Cancelar pedidos",
}

# Roles base del sistema y los permisos que otorgan.
# "*" = todos los permisos (superadmin).
ROLES: dict[str, dict] = {
    "superadmin": {
        "descripcion": "Acceso total al sistema",
        "permisos": "*",
    },
    "staff": {
        "descripcion": "Operación de tienda: catálogo, inventario y pedidos",
        "permisos": [
            "usuarios.leer",
            "productos.leer", "productos.crear", "productos.editar",
            "inventario.leer", "inventario.ajustar",
            "pedidos.leer", "pedidos.editar", "pedidos.cancelar",
        ],
    },
    "cliente": {
        "descripcion": "Cliente registrado",
        "permisos": ["productos.leer", "pedidos.crear", "pedidos.leer_propios"],
    },
    "invitado": {
        "descripcion": "Compra sin registro (checkout de invitado)",
        "permisos": ["productos.leer", "pedidos.crear"],
    },
}


def seed() -> None:
    db = SessionLocal()
    try:
        # 1) Permisos
        existentes = {p.codigo: p for p in db.scalars(select(Permiso)).all()}
        for codigo, descripcion in PERMISOS.items():
            if codigo not in existentes:
                p = Permiso(codigo=codigo, descripcion=descripcion)
                db.add(p)
                existentes[codigo] = p
        db.flush()

        # 2) Roles + asignación de permisos
        roles_db = {r.nombre: r for r in db.scalars(select(Rol)).all()}
        for nombre, cfg in ROLES.items():
            rol = roles_db.get(nombre)
            if rol is None:
                rol = Rol(
                    nombre=nombre,
                    descripcion=cfg["descripcion"],
                    es_sistema=True,
                )
                db.add(rol)
                roles_db[nombre] = rol

            if cfg["permisos"] == "*":
                rol.permisos = list(existentes.values())
            else:
                rol.permisos = [existentes[c] for c in cfg["permisos"]]

        db.commit()
        print(
            f"Seed OK: {len(existentes)} permisos, {len(roles_db)} roles "
            "(superadmin, staff, cliente, invitado)."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
