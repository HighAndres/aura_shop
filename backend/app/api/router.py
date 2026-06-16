"""Router agregador de la API v1: reúne todos los routers de negocio."""

from fastapi import APIRouter

from app.api.routes import auth, catalog, inventory, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(catalog.router)
api_router.include_router(inventory.router)
