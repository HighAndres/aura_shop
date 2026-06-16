"""Router agregador de la API v1: reúne todos los routers de negocio."""

from fastapi import APIRouter

from app.api.routes import (
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
