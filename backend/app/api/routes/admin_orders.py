"""Endpoints administrativos de pedidos (staff con permisos pedidos.*)."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    has_permission,
    require_any_permission,
    require_permissions,
)
from app.core import audit
from app.core.order_state import (
    PERMISO_POR_ESTADO,
    TransicionInvalida,
    permiso_para,
    registrar_creacion,
    transicionar,
)
from app.crud import inventory as crud_inv
from app.crud.order import _etiqueta_variante, _siguiente_numero
from app.db.session import get_db
from app.models.catalog import Variante
from app.models.inventory import StockMovimiento, TipoMovimiento
from app.models.order import EstadoPedido, OrigenTransicion, Pedido, PedidoItem
from app.models.user import Usuario
from app.schemas.order import PedidoDetalleRead, PedidoRead

ALMACEN_CHECKOUT = "PRINCIPAL"


def _nombre(u: Usuario | None) -> str | None:
    if u is None:
        return None
    return u.nombre_completo or u.email


def _serialize_pedido(pedido: Pedido, db: Session) -> PedidoRead:
    data = PedidoRead.model_validate(pedido)
    if pedido.asignado_a:
        data.asignado_a_nombre = _nombre(db.get(Usuario, pedido.asignado_a))
    return data


def _serialize_detalle(pedido: Pedido, db: Session) -> PedidoDetalleRead:
    data = PedidoDetalleRead.model_validate(pedido)
    if pedido.asignado_a:
        data.asignado_a_nombre = _nombre(db.get(Usuario, pedido.asignado_a))
    # El actor viene precargado por el relationship, así que esto no consulta.
    for asiento, leido in zip(pedido.historial, data.historial):
        leido.actor_nombre = _nombre(asiento.actor)
    return data

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])

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
    variantes = db.scalars(
        select(Variante).where(Variante.id.in_(variante_ids)).with_for_update()
    ).all()
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
        # Nace pendiente, igual que el checkout de la tienda: el pago lo
        # confirma la pasarela, no el acto de levantar el pedido.
        estado="pendiente",
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
    registrar_creacion(
        db,
        pedido,
        origen=OrigenTransicion.USUARIO,
        actor=current_user,
        nota="Pedido levantado desde el panel",
    )

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
    summary="Listar pedidos (todos, o solo los asignados según el rol)",
)
def listar_pedidos_admin(
    db: Session = Depends(get_db),
    estado: str | None = Query(default=None),
    q: str | None = Query(default=None, description="buscar por número o email"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: Usuario = Depends(
        require_any_permission("pedidos.leer", "pedidos.leer_asignados")
    ),
) -> PedidoPage:
    query = select(Pedido)
    count_query = select(func.count()).select_from(Pedido)

    # Quien no puede ver todos los pedidos solo ve los suyos.
    if not has_permission(current_user, "pedidos.leer"):
        query = query.where(Pedido.asignado_a == current_user.id)
        count_query = count_query.where(Pedido.asignado_a == current_user.id)

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


@router.get(
    "/{numero}",
    response_model=PedidoDetalleRead,
    summary="Detalle de un pedido, con su línea de tiempo de estados",
)
def detalle_pedido(
    numero: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(
        require_any_permission("pedidos.leer", "pedidos.leer_asignados")
    ),
) -> PedidoDetalleRead:
    pedido = db.scalar(select(Pedido).where(Pedido.numero == numero))
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")

    # Quien solo ve los suyos no debe poder abrir el de otro por número.
    if not has_permission(current_user, "pedidos.leer"):
        if pedido.asignado_a != current_user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")

    return _serialize_detalle(pedido, db)


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
    current_user: Usuario = Depends(get_current_active_user),
) -> PedidoRead:
    if body.estado not in [e.value for e in EstadoPedido]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Estado inválido: {body.estado}")

    # El permiso se valida antes de buscar el pedido: si se hiciera después,
    # el 404 vs 403 delataría qué números de pedido existen a quien no tiene
    # permiso de tocarlos.
    permiso = permiso_para(body.estado)
    if permiso is None or not has_permission(current_user, permiso):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"No tienes permisos para marcar un pedido como '{body.estado}'",
        )

    pedido = db.scalar(select(Pedido).where(Pedido.numero == numero))
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")

    try:
        estado_anterior = transicionar(
            db,
            pedido,
            body.estado,
            origen=OrigenTransicion.USUARIO,
            actor=current_user,
            nota=body.nota,
        )
    except TransicionInvalida as e:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    db.commit()
    db.refresh(pedido)

    audit.registrar(
        db,
        actor=current_user,
        accion=permiso,
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

    try:
        # La restauración de inventario la hace la propia transición.
        estado_anterior = transicionar(
            db,
            pedido,
            "cancelado",
            origen=OrigenTransicion.USUARIO,
            actor=current_user,
        )
    except TransicionInvalida as e:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

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
    current_user: Usuario = Depends(require_permissions("pedidos.reasignar")),
) -> PedidoRead:
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
        accion="pedidos.reasignar",
        descripcion=f"Pedido {numero} reasignado",
        entidad="pedido",
        entidad_id=numero,
        cambios={"asignado_anterior": str(anterior), "asignado_nuevo": str(pedido.asignado_a)},
        request=request,
    )

    return _serialize_pedido(pedido, db)
