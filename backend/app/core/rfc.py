"""Validación y normalización de RFC (México).

Estructura:
    Persona física:  4 letras + AAMMDD + 3 de homoclave = 13
    Persona moral:   3 letras + AAMMDD + 3 de homoclave = 12

Valida la forma, no la existencia: confirmar que un RFC está dado de alta
requiere consultar al SAT, que es otro problema.
"""

from __future__ import annotations

import re

# La Ñ y el & son válidos en la razón social. La homoclave es alfanumérica.
_RFC_RE = re.compile(r"^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$")

LONGITUD_MORAL = 12
LONGITUD_FISICA = 13


def normalizar_rfc(valor: str) -> str:
    """Mayúsculas y sin espacios ni guiones: la gente lo teclea de mil formas."""
    return re.sub(r"[\s-]", "", valor).upper()


def rfc_valido(valor: str) -> bool:
    normalizado = normalizar_rfc(valor)
    if len(normalizado) not in (LONGITUD_MORAL, LONGITUD_FISICA):
        return False
    if not _RFC_RE.match(normalizado):
        return False
    return _fecha_plausible(normalizado)


def es_persona_moral(valor: str) -> bool:
    return len(normalizar_rfc(valor)) == LONGITUD_MORAL


def _fecha_plausible(normalizado: str) -> bool:
    """Los 6 dígitos centrales son AAMMDD; descarta mes 00/13+ y día 00/32+.

    No se valida contra el calendario real (28/29/30/31): un RFC con fecha
    imposible existiría igual en el SAT, y rechazarlo daría más falsos
    negativos que valor.
    """
    inicio = 4 if len(normalizado) == LONGITUD_FISICA else 3
    fecha = normalizado[inicio : inicio + 6]
    mes, dia = int(fecha[2:4]), int(fecha[4:6])
    return 1 <= mes <= 12 and 1 <= dia <= 31


def validar_rfc(valor: str) -> str:
    """Devuelve el RFC normalizado o lanza ValueError. Para usar en Pydantic."""
    normalizado = normalizar_rfc(valor)
    if not rfc_valido(normalizado):
        raise ValueError(
            "RFC inválido. Debe ser de 13 caracteres (persona física) "
            "o 12 (persona moral); por ejemplo GODE561231GR8."
        )
    return normalizado
