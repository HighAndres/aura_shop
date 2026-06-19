"""Router agregador de la API v1: reúne todos los routers de negocio."""

from fastapi import APIRouter

from app.api.routes import (
    admin_catalog,
    admin_orders,
    admin_reports,
    admin_users,
    audit,
    auth,
    cart,
    catalog,
    inventory,
    orders,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(catalog.router)
api_router.include_router(inventory.router)
api_router.include_router(cart.router)
api_router.include_router(orders.router)
api_router.include_router(audit.router)
api_router.include_router(admin_orders.router)
api_router.include_router(admin_catalog.router)
api_router.include_router(admin_users.router)
api_router.include_router(admin_reports.router)
