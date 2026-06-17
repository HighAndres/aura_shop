"""Utilidades de texto."""

import re
import unicodedata


def slugify(value: str) -> str:
    """Convierte un texto a slug: minúsculas, sin acentos, con guiones."""
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value or "item"
