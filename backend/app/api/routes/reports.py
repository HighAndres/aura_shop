"""Endpoints de reportes de operación (permiso reportes.leer: admin + superadmin)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.crud import reports as crud
from app.db.session import get_db
from app.schemas.reports import StockBajoItem, TopProducto, VentasResumen

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_permissions("reportes.leer"))],
)


@router.get("/ventas", response_model=VentasResumen, summary="Resumen de ventas")
def ventas(db: Session = Depends(get_db)) -> VentasResumen:
    return VentasResumen(**crud.ventas_resumen(db))


@router.get(
    "/top-productos",
    response_model=list[TopProducto],
    summary="Productos más vendidos",
)
def top_productos(
    db: Session = Depends(get_db),
    limit: int = Query(default=10, ge=1, le=50),
) -> list[TopProducto]:
    return [
        TopProducto(sku=s, nombre=n, cantidad=c, ingreso=i)
        for s, n, c, i in crud.top_productos(db, limit=limit)
    ]


@router.get(
    "/stock-bajo",
    response_model=list[StockBajoItem],
    summary="Variantes con stock bajo",
)
def stock_bajo(
    db: Session = Depends(get_db),
    umbral: int = Query(default=5, ge=0, le=100),
) -> list[StockBajoItem]:
    return [
        StockBajoItem(sku=s, producto=p, disponible=d)
        for s, p, d in crud.stock_bajo(db, umbral=umbral)
    ]
