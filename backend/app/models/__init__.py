"""Registro central de modelos.

Importar todos los modelos aquí garantiza que Alembic los descubra
(metadata completa) al generar migraciones.
"""

from app.models.rbac import Permiso, Rol, rol_permisos, usuario_roles
from app.models.user import Usuario

__all__ = [
    "Usuario",
    "Rol",
    "Permiso",
    "usuario_roles",
    "rol_permisos",
]
