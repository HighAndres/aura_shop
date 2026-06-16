"""Endpoints de inventario (admin). Protegidos por permisos RBAC."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.crud import inventory as crud
from app.db.session import get_db
from app.models.inventory import StockMovimiento, TipoMovimiento
from app.schemas.inventory import (
    AlmacenRead,
    MovimientoCreate,
    MovimientoRead,
    StockItem,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _serialize_mov(mov: StockMovimiento) -> MovimientoRead:
    return MovimientoRead(
        id=mov.id,
        sku=mov.variante.sku,
        almacen=mov.almacen.codigo,
        tipo=mov.tipo,
        cantidad=mov.cantidad,
        lote=mov.lote.codigo if mov.lote else None,
        referencia=mov.referencia,
        nota=mov.nota,
        fecha=mov.fecha,
    )


def _validar_signo(tipo: TipoMovimiento, cantidad: int) -> None:
    if cantidad == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La cantidad no puede ser 0")
    if tipo == TipoMovimiento.ENTRADA and cantidad < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Una entrada debe ser positiva")
    if tipo == TipoMovimiento.SALIDA and cantidad > 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Una salida debe ser negativa")


@router.get(
    "/almacenes",
    response_model=list[AlmacenRead],
    summary="Listar almacenes",
    dependencies=[Depends(require_permissions("inventario.leer"))],
)
def listar_almacenes(db: Session = Depends(get_db)) -> list[AlmacenRead]:
    return [AlmacenRead.model_validate(a) for a in crud.list_almacenes(db)]


@router.get(
    "/stock",
    response_model=list[StockItem],
    summary="Stock disponible (suma del ledger)",
    dependencies=[Depends(require_permissions("inventario.leer"))],
)
def consultar_stock(
    db: Session = Depends(get_db),
    sku: str | None = Query(default=None),
    almacen: str | None = Query(default=None, description="código de almacén"),
) -> list[StockItem]:
    filas = crud.stock_actual(db, sku=sku, almacen=almacen)
    return [
        StockItem(sku=s, producto=p, almacen=a, disponible=d)
        for s, p, a, d in filas
    ]


@router.get(
    "/movimientos",
    response_model=list[MovimientoRead],
    summary="Historial de movimientos",
    dependencies=[Depends(require_permissions("inventario.leer"))],
)
def listar_movimientos(
    db: Session = Depends(get_db),
    sku: str | None = Query(default=None),
    almacen: str | None = Query(default=None),
    tipo: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[MovimientoRead]:
    movs = crud.list_movimientos(
        db, sku=sku, almacen=almacen, tipo=tipo, limit=limit, offset=offset
    )
    return [_serialize_mov(m) for m in movs]


@router.post(
    "/movimientos",
    response_model=MovimientoRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar movimiento de inventario",
    dependencies=[Depends(require_permissions("inventario.ajustar"))],
)
def crear_movimiento(
    body: MovimientoCreate, db: Session = Depends(get_db)
) -> MovimientoRead:
    _validar_signo(body.tipo, body.cantidad)

    variante = crud.get_variante_by_sku(db, body.sku)
    if variante is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"SKU no encontrado: {body.sku}")
    almacen = crud.get_almacen_by_codigo(db, body.almacen)
    if almacen is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"Almacén no encontrado: {body.almacen}"
        )

    lote = None
    if body.lote_codigo:
        lote = crud.get_or_create_lote(
            db, variante.id, body.lote_codigo, body.lote_caducidad
        )

    try:
        mov = crud.registrar_movimiento(
            db,
            variante=variante,
            almacen=almacen,
            tipo=body.tipo,
            cantidad=body.cantidad,
            lote=lote,
            referencia=body.referencia,
            nota=body.nota,
        )
    except crud.StockInsuficienteError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    return _serialize_mov(mov)
