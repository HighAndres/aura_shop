"""Seed de datos de ejemplo del catálogo (para desarrollo/pruebas).

Idempotente a nivel de producto: si ya existen los slugs, no duplica.
Ejecutar: python scripts/seed_catalog.py
"""

from decimal import Decimal

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.catalog import (
    Atributo,
    Categoria,
    Marca,
    Producto,
    ProductoImagen,
    ValorAtributo,
    Variante,
)
from app.models.review import Resena
from app.models.user import Usuario


def _get_or_create(db, model, defaults=None, **filtros):
    obj = db.scalar(select(model).filter_by(**filtros))
    if obj:
        return obj, False
    obj = model(**filtros, **(defaults or {}))
    db.add(obj)
    db.flush()
    return obj, True


def seed() -> None:
    db = SessionLocal()
    try:
        # --- Atributos y valores ---
        tono, _ = _get_or_create(db, Atributo, nombre="Tono", slug="tono")
        tam, _ = _get_or_create(db, Atributo, nombre="Tamaño", slug="tamano")

        tonos = {}
        for valor, slug in [("Rojo", "rojo"), ("Nude", "nude"), ("Coral", "coral")]:
            v, _ = _get_or_create(
                db, ValorAtributo, atributo_id=tono.id, slug=slug,
                defaults={"valor": valor},
            )
            tonos[slug] = v
        tamanos = {}
        for valor, slug in [("30 ml", "30ml"), ("50 ml", "50ml")]:
            v, _ = _get_or_create(
                db, ValorAtributo, atributo_id=tam.id, slug=slug,
                defaults={"valor": valor},
            )
            tamanos[slug] = v

        # --- Marcas y categorías ---
        aura, _ = _get_or_create(
            db, Marca, slug="aura-beauty", defaults={"nombre": "Aura Beauty"}
        )
        lumiere, _ = _get_or_create(
            db, Marca, slug="lumiere", defaults={"nombre": "Lumière"}
        )
        cat_labiales, _ = _get_or_create(
            db, Categoria, slug="labiales", defaults={"nombre": "Labiales"}
        )
        cat_facial, _ = _get_or_create(
            db, Categoria, slug="cuidado-facial",
            defaults={"nombre": "Cuidado facial"},
        )

        # --- Producto 1: Labial mate (variantes por tono) ---
        if not db.scalar(select(Producto).where(Producto.slug == "labial-mate")):
            labial = Producto(
                nombre="Labial Mate Larga Duración",
                slug="labial-mate",
                descripcion_corta="Color intenso, acabado mate hasta 12h.",
                descripcion="Labial de larga duración con acabado mate aterciopelado.",
                marca_id=aura.id,
                categoria_id=cat_labiales.id,
                destacado=True,
            )
            labial.imagenes.append(
                ProductoImagen(
                    url="https://picsum.photos/seed/labial/600",
                    alt="Labial mate", es_principal=True,
                )
            )
            for slug, precio in [("rojo", "199.00"), ("nude", "199.00"), ("coral", "189.00")]:
                v = Variante(
                    sku=f"LAB-MATE-{slug.upper()}",
                    nombre=f"Tono {tonos[slug].valor}",
                    precio=Decimal(precio),
                    precio_comparativo=Decimal("249.00"),
                )
                v.valores.append(tonos[slug])
                labial.variantes.append(v)
            db.add(labial)
            db.flush()

            # Una reseña aprobada (usa el primer usuario si existe)
            autor = db.scalar(select(Usuario).limit(1))
            db.add(
                Resena(
                    producto_id=labial.id,
                    usuario_id=autor.id if autor else None,
                    rating=5,
                    titulo="¡Me encantó!",
                    comentario="Dura todo el día y el color es precioso.",
                    aprobada=True,
                )
            )

        # --- Producto 2: Serum (variantes por tamaño) ---
        if not db.scalar(select(Producto).where(Producto.slug == "serum-vitc")):
            serum = Producto(
                nombre="Serum Vitamina C",
                slug="serum-vitc",
                descripcion_corta="Ilumina y unifica el tono.",
                marca_id=lumiere.id,
                categoria_id=cat_facial.id,
                destacado=True,
            )
            serum.imagenes.append(
                ProductoImagen(
                    url="https://picsum.photos/seed/serum/600",
                    alt="Serum Vitamina C", es_principal=True,
                )
            )
            for slug, precio in [("30ml", "399.00"), ("50ml", "599.00")]:
                v = Variante(
                    sku=f"SERUM-VITC-{slug.upper()}",
                    nombre=tamanos[slug].valor,
                    precio=Decimal(precio),
                )
                v.valores.append(tamanos[slug])
                serum.variantes.append(v)
            db.add(serum)

        # --- Producto 3: Bruma (variante única) ---
        if not db.scalar(select(Producto).where(Producto.slug == "bruma-facial")):
            bruma = Producto(
                nombre="Bruma Facial Hidratante",
                slug="bruma-facial",
                descripcion_corta="Hidratación instantánea con agua de rosas.",
                marca_id=aura.id,
                categoria_id=cat_facial.id,
            )
            bruma.imagenes.append(
                ProductoImagen(
                    url="https://picsum.photos/seed/bruma/600",
                    alt="Bruma facial", es_principal=True,
                )
            )
            bruma.variantes.append(
                Variante(sku="BRUMA-100", precio=Decimal("149.00"))
            )
            db.add(bruma)

        db.commit()
        total = db.scalar(select(func.count()).select_from(Producto))
        print(f"Seed catálogo OK. Productos en BD: {total}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
