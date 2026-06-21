"""Endpoints administrativos de pedidos (staff con permisos pedidos.*)."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.core import audit
from app.crud import inventory as crud_inv
from app.crud.order import _etiqueta_variante, _siguiente_numero, restaurar_inventario
from app.db.session import get_db
from app.models.catalog import Variante
from app.models.inventory import StockMovimiento, TipoMovimiento
from app.models.order import EstadoPedido, Pedido, PedidoItem
from app.models.user import Usuario
from app.schemas.order import PedidoRead

ADMIN_ROLES = {"superadmin", "administrador"}
ALMACEN_CHECKOUT = "PRINCIPAL"


def _serialize_pedido(pedido: Pedido, db: Session) -> PedidoRead:
    data = PedidoRead.model_validate(pedido)
    if pedido.asignado_a:
        asignado = db.get(Usuario, pedido.asignado_a)
        if asignado:
            data.asignado_a_nombre = asignado.nombre_completo or asignado.email
    return data

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])

TRANSICIONES_VALIDAS: dict[str, list[str]] = {
    "pendiente": ["pagado", "cancelado"],
    "pagado": ["enviado", "cancelado"],
    "enviado": ["entregado"],
    "entregado": [],
    "cancelado": [],
}


class PedidoPage(BaseModel):
    items: list[PedidoRead]
    total: int
    limit: int
    offset: int


class CambiarEstadoIn(BaseModel):
    estado: str
    nota: str | None = None


class CrearPedidoItemIn(BaseModel):
    variante_id: str
    cantidad: int = Field(ge=1)


class CrearPedidoIn(BaseModel):
    email: EmailStr
    nombre_contacto: str = Field(min_length=1, max_length=255)
    telefono: str | None = Field(default=None, max_length=32)
    direccion_calle: str | None = Field(default=None, max_length=255)
    direccion_ciudad: str | None = Field(default=None, max_length=120)
    direccion_estado: str | None = Field(default=None, max_length=120)
    direccion_cp: str | None = Field(default=None, max_length=10)
    notas: str | None = None
    items: list[CrearPedidoItemIn] = Field(min_length=1)


@router.post(
    "",
    response_model=PedidoRead,
    status_code=status.HTTP_201_CREATED,
    summary="Levantar un pedido directamente (vendedor/admin)",
)
def crear_pedido_admin(
    body: CrearPedidoIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("pedidos.crear")),
) -> PedidoRead:
    if not body.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El pedido debe tener al menos un artículo")

    almacen = crud_inv.get_almacen_by_codigo(db, ALMACEN_CHECKOUT)
    if almacen is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"No existe el almacén {ALMACEN_CHECKOUT}")

    variante_ids = [it.variante_id for it in body.items]
    variantes = db.scalars(select(Variante).where(Variante.id.in_(variante_ids))).all()
    variante_map = {str(v.id): v for v in variantes}

    for it in body.items:
        if it.variante_id not in variante_map:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Variante {it.variante_id} no encontrada")

    faltantes = []
    for it in body.items:
        v = variante_map[it.variante_id]
        disp = crud_inv.disponible(db, v.id, almacen.id)
        if disp < it.cantidad:
            faltantes.append(f"{v.sku} (disponible: {disp}, pedido: {it.cantidad})")
    if faltantes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Stock insuficiente: {', '.join(faltantes)}")

    numero = _siguiente_numero(db)
    pedido = Pedido(
        numero=numero,
        usuario_id=None,
        asignado_a=current_user.id,
        email=body.email,
        estado="pagado",
        nombre_contacto=body.nombre_contacto,
        telefono=body.telefono,
        direccion_calle=body.direccion_calle,
        direccion_ciudad=body.direccion_ciudad,
        direccion_estado=body.direccion_estado,
        direccion_cp=body.direccion_cp,
        notas=body.notas,
        subtotal=Decimal("0"),
        envio=Decimal("0"),
        total=Decimal("0"),
    )

    subtotal = Decimal("0")
    for it in body.items:
        v = variante_map[it.variante_id]
        linea = (v.precio * it.cantidad).quantize(Decimal("0.01"))
        subtotal += linea
        pedido.items.append(PedidoItem(
            variante_id=v.id,
            sku=v.sku,
            nombre=_etiqueta_variante(v),
            cantidad=it.cantidad,
            precio_unitario=v.precio,
            subtotal=linea,
        ))
        db.add(StockMovimiento(
            variante_id=v.id,
            almacen_id=almacen.id,
            tipo=TipoMovimiento.SALIDA.value,
            cantidad=-it.cantidad,
            referencia=numero,
            nota="Venta directa (vendedor)",
        ))

    pedido.subtotal = subtotal
    pedido.total = subtotal
    db.add(pedido)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Error al generar el pedido, intenta de nuevo")

    db.refresh(pedido)

    audit.registrar(
        db,
        actor=current_user,
        accion="pedidos.crear",
        descripcion=f"Pedido {numero} creado por vendedor para {body.email}",
        entidad="pedido",
        entidad_id=numero,
        cambios={"items": len(body.items), "total": str(pedido.total)},
        request=request,
    )

    return _serialize_pedido(pedido, db)


@router.get(
    "",
    response_model=PedidoPage,
    summary="Listar todos los pedidos (admin)",
    dependencies=[Depends(require_permissions("pedidos.leer"))],
)
def listar_pedidos_admin(
    db: Session = Depends(get_db),
    estado: str | None = Query(default=None),
    q: str | None = Query(default=None, description="buscar por número o email"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PedidoPage:
    query = select(Pedido)
    count_query = select(func.count()).select_from(Pedido)

    if estado:
        query = query.where(Pedido.estado == estado)
        count_query = count_query.where(Pedido.estado == estado)
    if q:
        esc = q.replace("%", r"\%").replace("_", r"\_")
        filtro = Pedido.numero.ilike(f"%{esc}%") | Pedido.email.ilike(f"%{esc}%")
        query = query.where(filtro)
        count_query = count_query.where(filtro)

    total = db.scalar(count_query) or 0
    pedidos = db.scalars(
        query.order_by(Pedido.created_at.desc()).offset(offset).limit(limit)
    ).all()

    return PedidoPage(
        items=[_serialize_pedido(p, db) for p in pedidos],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.put(
    "/{numero}/estado",
    response_model=PedidoRead,
    summary="Cambiar estado de un pedido",
)
def cambiar_estado(
    numero: str,
    body: CambiarEstadoIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("pedidos.editar")),
) -> PedidoRead:
    pedido = db.scalar(select(Pedido).where(Pedido.numero == numero))
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")

    if body.estado not in [e.value for e in EstadoPedido]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Estado inválido: {body.estado}")

    validos = TRANSICIONES_VALIDAS.get(pedido.estado, [])
    if body.estado not in validos:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"No se puede cambiar de '{pedido.estado}' a '{body.estado}'. "
            f"Transiciones válidas: {validos}",
        )

    estado_anterior = pedido.estado
    pedido.estado = body.estado
    db.commit()
    db.refresh(pedido)

    audit.registrar(
        db,
        actor=current_user,
        accion="pedidos.editar",
        descripcion=f"Pedido {numero}: {estado_anterior} → {body.estado}",
        entidad="pedido",
        entidad_id=numero,
        cambios={
            "estado_anterior": estado_anterior,
            "estado_nuevo": body.estado,
            "nota": body.nota,
        },
        request=request,
    )

    return _serialize_pedido(pedido, db)


@router.put(
    "/{numero}/cancelar",
    response_model=PedidoRead,
    summary="Cancelar un pedido",
)
def cancelar_pedido(
    numero: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("pedidos.cancelar")),
) -> PedidoRead:
    pedido = db.scalar(select(Pedido).where(Pedido.numero == numero))
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")

    if pedido.estado == "cancelado":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El pedido ya está cancelado")
    if pedido.estado == "entregado":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "No se puede cancelar un pedido entregado"
        )

    estado_anterior = pedido.estado
    pedido.estado = "cancelado"
    restaurar_inventario(db, pedido)
    db.commit()
    db.refresh(pedido)

    audit.registrar(
        db,
        actor=current_user,
        accion="pedidos.cancelar",
        descripcion=f"Pedido {numero} cancelado (era: {estado_anterior}), inventario restaurado",
        entidad="pedido",
        entidad_id=numero,
        cambios={"estado_anterior": estado_anterior, "estado_nuevo": "cancelado"},
        request=request,
    )

    return _serialize_pedido(pedido, db)


class ReasignarIn(BaseModel):
    asignado_a: str | None = None


@router.put(
    "/{numero}/asignar",
    response_model=PedidoRead,
    summary="Reasignar pedido a otro usuario staff",
)
def reasignar_pedido(
    numero: str,
    body: ReasignarIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permissions("pedidos.editar")),
) -> PedidoRead:
    if not ({r.nombre for r in current_user.roles} & ADMIN_ROLES):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Solo administradores pueden reasignar pedidos",
        )

    pedido = db.scalar(select(Pedido).where(Pedido.numero == numero))
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")

    anterior = pedido.asignado_a

    if body.asignado_a:
        target = db.get(Usuario, body.asignado_a)
        if target is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Usuario no encontrado")
        pedido.asignado_a = target.id
    else:
        pedido.asignado_a = None

    db.commit()
    db.refresh(pedido)

    audit.registrar(
        db,
        actor=current_user,
        accion="pedidos.editar",
        descripcion=f"Pedido {numero} reasignado",
        entidad="pedido",
        entidad_id=numero,
        cambios={"asignado_anterior": str(anterior), "asignado_nuevo": str(pedido.asignado_a)},
        request=request,
    )

    return _serialize_pedido(pedido, db)
