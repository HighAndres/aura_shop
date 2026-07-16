"""Máquina de estados de pedidos.

Único lugar donde se decide si un cambio de estado es válido, quién puede
pedirlo y qué efectos arrastra. Los endpoints, la pasarela de pagos y
cualquier proceso interno pasan por `transicionar()`; nadie asigna
`pedido.estado` a mano.

Esto existe porque antes las reglas vivían en el router y había dos caminos
para cancelar: uno restauraba el inventario y el otro no.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.order import OrigenTransicion, Pedido, PedidoEstadoHistorial
from app.models.user import Usuario

# Transiciones que permite el negocio, independientemente de quién las pida.
TRANSICIONES_VALIDAS: dict[str, list[str]] = {
    "pendiente": ["pagado", "cancelado"],
    "pagado": ["enviado", "cancelado"],
    "enviado": ["entregado"],
    "entregado": [],
    "cancelado": [],
}

# Permiso necesario para llevar un pedido a cada estado. Se resuelve contra el
# estado destino porque depende de lo que se pide, no del endpoint.
#
# "pagado" no lo tiene ningún rol operativo: esa transición le corresponde a la
# pasarela de pagos. Solo superadmin la conserva como escotilla de emergencia.
PERMISO_POR_ESTADO: dict[str, str] = {
    "pagado": "pedidos.marcar_pagado",
    "enviado": "pedidos.marcar_enviado",
    "entregado": "pedidos.marcar_entregado",
    "cancelado": "pedidos.cancelar",
}

# Estados en los que el stock reservado vuelve al inventario.
ESTADOS_QUE_RESTAURAN_INVENTARIO = {"cancelado"}


class TransicionInvalida(Exception):
    """La transición pedida no la permite la máquina de estados."""

    def __init__(self, desde: str, hacia: str) -> None:
        self.desde = desde
        self.hacia = hacia
        validos = TRANSICIONES_VALIDAS.get(desde, [])
        super().__init__(
            f"No se puede cambiar de '{desde}' a '{hacia}'. "
            f"Transiciones válidas: {validos}"
        )


def transiciones_validas(estado: str) -> list[str]:
    return TRANSICIONES_VALIDAS.get(estado, [])


def permiso_para(estado: str) -> str | None:
    return PERMISO_POR_ESTADO.get(estado)


def registrar_creacion(
    db: Session,
    pedido: Pedido,
    *,
    origen: OrigenTransicion = OrigenTransicion.USUARIO,
    actor: Usuario | None = None,
    nota: str | None = None,
) -> None:
    """Asienta el estado inicial del pedido en el historial.

    Sin esto el historial empezaría en la primera transición y no se sabría
    cuándo nació el pedido ni quién lo levantó.
    """
    db.add(
        PedidoEstadoHistorial(
            pedido=pedido,
            estado_anterior=None,
            estado_nuevo=pedido.estado,
            origen=origen.value,
            actor_id=actor.id if actor else None,
            nota=nota,
        )
    )


def transicionar(
    db: Session,
    pedido: Pedido,
    nuevo_estado: str,
    *,
    origen: OrigenTransicion,
    actor: Usuario | None = None,
    nota: str | None = None,
    referencia: str | None = None,
) -> str:
    """Cambia el estado de un pedido aplicando reglas y efectos.

    Valida la transición, restaura inventario si corresponde y deja el asiento
    en el historial. NO hace commit: lo decide quien llama, para que el cambio
    de estado y sus efectos caigan en la misma transacción.

    Devuelve el estado anterior. Lanza TransicionInvalida si no se permite.

    No valida permisos: eso es responsabilidad de la capa HTTP, porque la
    pasarela y los procesos internos no tienen usuario contra quién validar.
    """
    estado_anterior = pedido.estado

    if nuevo_estado not in TRANSICIONES_VALIDAS.get(estado_anterior, []):
        raise TransicionInvalida(estado_anterior, nuevo_estado)

    # Importación diferida: crud.order importa modelos que a su vez llegarían
    # aquí, y a nivel de módulo se haría circular.
    from app.crud.order import restaurar_inventario

    if nuevo_estado in ESTADOS_QUE_RESTAURAN_INVENTARIO:
        restaurar_inventario(db, pedido)

    pedido.estado = nuevo_estado

    db.add(
        PedidoEstadoHistorial(
            pedido=pedido,
            estado_anterior=estado_anterior,
            estado_nuevo=nuevo_estado,
            origen=origen.value,
            actor_id=actor.id if actor else None,
            nota=nota,
            referencia=referencia,
        )
    )

    return estado_anterior
