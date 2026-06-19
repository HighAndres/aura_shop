"""Registro central de modelos.

Importar todos los modelos aquí garantiza que Alembic los descubra
(metadata completa) al generar migraciones.
"""

from app.models.catalog import (
    Atributo,
    Categoria,
    Marca,
    Producto,
    ProductoImagen,
    ValorAtributo,
    Variante,
    variante_valores,
)
from app.models.audit import Auditoria
from app.models.bundle import Paquete, PaqueteItem
from app.models.cart import Carrito, CarritoItem
from app.models.inventory import (
    Almacen,
    Lote,
    StockMovimiento,
    TipoMovimiento,
)
from app.models.order import EstadoPedido, Pedido, PedidoItem
from app.models.rbac import Permiso, Rol, rol_permisos, usuario_roles
from app.models.review import Resena
from app.models.user import Usuario

__all__ = [
    # usuarios / rbac
    "Usuario",
    "Rol",
    "Permiso",
    "usuario_roles",
    "rol_permisos",
    # catálogo
    "Marca",
    "Categoria",
    "Producto",
    "Variante",
    "Atributo",
    "ValorAtributo",
    "ProductoImagen",
    "variante_valores",
    # reseñas
    "Resena",
    # inventario
    "Almacen",
    "Lote",
    "StockMovimiento",
    "TipoMovimiento",
    # carrito
    "Carrito",
    "CarritoItem",
    # pedidos
    "Pedido",
    "PedidoItem",
    "EstadoPedido",
    # paquetes
    "Paquete",
    "PaqueteItem",
    # auditoría
    "Auditoria",
]
