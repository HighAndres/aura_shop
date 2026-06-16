"""Seed de inventario para desarrollo: un almacén y stock inicial.

Idempotente: no duplica el almacén ni vuelve a cargar stock si ya existe.
Ejecutar DESPUÉS de seed_catalog.py:  python scripts/seed_inventory.py
"""

from datetime import date

from sqlalchemy import select

from app.crud import inventory as crud
from app.db.session import SessionLocal
from app.models.inventory import Almacen, StockMovimiento, TipoMovimiento

# Stock inicial por SKU. El serum lleva lote con caducidad.
STOCK_INICIAL = {
    "LAB-MATE-ROJO": (50, None, None),
    "LAB-MATE-NUDE": (50, None, None),
    "LAB-MATE-CORAL": (30, None, None),
    "SERUM-VITC-30ML": (40, "LOTE-2025A", date(2027, 12, 31)),
    "SERUM-VITC-50ML": (25, "LOTE-2025A", date(2027, 12, 31)),
    "BRUMA-100": (80, None, None),
}


def seed() -> None:
    db = SessionLocal()
    try:
        almacen = crud.get_almacen_by_codigo(db, "PRINCIPAL")
        if almacen is None:
            almacen = Almacen(nombre="Almacén Principal", codigo="PRINCIPAL")
            db.add(almacen)
            db.commit()
            db.refresh(almacen)

        # Si ya hay movimientos, no recargamos (idempotencia simple).
        existe_mov = db.scalar(select(StockMovimiento.id).limit(1))
        if existe_mov:
            print("Ya hay movimientos de inventario; no se recarga stock.")
            return

        cargados = 0
        for sku, (cantidad, lote_codigo, caducidad) in STOCK_INICIAL.items():
            variante = crud.get_variante_by_sku(db, sku)
            if variante is None:
                print(f"  (omitido) SKU sin variante: {sku}")
                continue
            lote = None
            if lote_codigo:
                lote = crud.get_or_create_lote(db, variante.id, lote_codigo, caducidad)
            crud.registrar_movimiento(
                db,
                variante=variante,
                almacen=almacen,
                tipo=TipoMovimiento.ENTRADA,
                cantidad=cantidad,
                lote=lote,
                referencia="SEED-INICIAL",
                nota="Carga inicial de inventario (seed)",
            )
            cargados += 1

        print(f"Seed inventario OK: almacén PRINCIPAL, {cargados} SKUs con stock.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
