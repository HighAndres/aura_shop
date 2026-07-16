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
    "perfil.editar_propio": "Editar el perfil propio",
    "productos.leer": "Ver catálogo",
    "productos.ver_precio": "Ver los precios del catálogo",
    "productos.crear": "Crear productos",
    "productos.editar": "Editar productos",
    "productos.eliminar": "Eliminar productos",
    "marcas.gestionar": "Alta, edición y baja de marcas",
    "categorias.gestionar": "Alta, edición y baja de categorías",
    "paquetes.gestionar": "Alta, edición y baja de paquetes",
    "inventario.leer": "Ver inventario",
    "inventario.ajustar": "Registrar movimientos de inventario",
    "pedidos.leer": "Ver todos los pedidos",
    "pedidos.leer_propios": "Ver pedidos propios (como cliente)",
    "pedidos.leer_asignados": "Ver únicamente los pedidos asignados a uno mismo",
    "pedidos.crear": "Crear pedidos",
    "pedidos.marcar_pagado": "Marcar un pedido como pagado",
    "pedidos.marcar_enviado": "Marcar un pedido como enviado",
    "pedidos.marcar_entregado": "Marcar un pedido como entregado",
    "pedidos.cancelar": "Cancelar pedidos",
    "pedidos.reasignar": "Reasignar pedidos a otro usuario",
    "reportes.leer": "Ver reportes",
    "bitacora.leer": "Ver la bitácora de auditoría",
    "configuracion.gestionar": "Gestionar la configuración del sistema",
}

# Permisos retirados del modelo. Se eliminan del catálogo y de los roles.
# "pedidos.editar" era demasiado grueso: cubría a la vez cambiar el estado y
# reasignar, lo que impedía distinguir quién puede marcar pagado vs. enviado.
PERMISOS_OBSOLETOS: list[str] = [
    "pedidos.editar",
]

# Roles base del sistema y los permisos que otorgan.
# "*" = todos los permisos (superadmin).
# Niveles internos: superadmin > administrador > vendedor.
#
# Sobre "pedidos.marcar_pagado": la transición pendiente -> pagado pertenece a
# la pasarela de pagos, no a una persona. Solo la conserva superadmin (vía "*")
# como escotilla de emergencia, y queda registrada en la bitácora.
ROLES: dict[str, dict] = {
    "superadmin": {
        "descripcion": "Acceso total, incluida la bitácora y la gestión de usuarios/roles",
        "permisos": "*",
    },
    "administrador": {
        "descripcion": "Operación: pick/pack/dispatch, catálogo, inventario y reportes (sin usuarios/roles ni bitácora)",
        "permisos": [
            "usuarios.leer",
            "perfil.editar_propio",
            "productos.leer", "productos.ver_precio",
            "productos.crear", "productos.editar",
            "paquetes.gestionar",
            "inventario.leer", "inventario.ajustar",
            "pedidos.leer", "pedidos.crear",
            "pedidos.marcar_enviado", "pedidos.marcar_entregado",
            "pedidos.cancelar", "pedidos.reasignar",
            "reportes.leer",
        ],
    },
    "vendedor": {
        "descripcion": "Levanta pedidos y consulta los suyos. Sin catálogo, sin inventario y sin cambiar estados",
        "permisos": [
            "perfil.editar_propio",
            "productos.leer", "productos.ver_precio",
            "pedidos.leer_asignados", "pedidos.crear",
            "reportes.leer",
        ],
    },
    "cliente": {
        "descripcion": "Cliente registrado",
        "permisos": [
            "perfil.editar_propio",
            "productos.leer", "productos.ver_precio",
            "pedidos.crear", "pedidos.leer_propios",
        ],
    },
    "invitado": {
        "descripcion": "Compra sin registro (checkout de invitado)",
        "permisos": ["productos.leer", "productos.ver_precio", "pedidos.crear"],
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

        # 2) Migración de nombre: staff -> vendedor (conserva asignaciones).
        staff = db.scalar(select(Rol).where(Rol.nombre == "staff"))
        if staff and not db.scalar(select(Rol).where(Rol.nombre == "vendedor")):
            staff.nombre = "vendedor"
            db.flush()

        # 3) Roles + asignación de permisos
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

        db.flush()

        # 4) Retiro de permisos obsoletos. El ondelete CASCADE de rol_permisos
        #    limpia las asignaciones.
        retirados = 0
        for codigo in PERMISOS_OBSOLETOS:
            p = db.scalar(select(Permiso).where(Permiso.codigo == codigo))
            if p is not None:
                db.delete(p)
                existentes.pop(codigo, None)
                retirados += 1

        db.commit()
        print(
            f"Seed OK: {len(existentes)} permisos, {len(roles_db)} roles "
            "(superadmin, administrador, vendedor, cliente, invitado)."
        )
        if retirados:
            print(f"Permisos obsoletos retirados: {retirados}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
