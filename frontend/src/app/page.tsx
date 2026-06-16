import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { getCategorias, getProductos } from "@/lib/catalog";
import type { Categoria, ProductoListItem } from "@/lib/types";

export default async function HomePage() {
  let destacados: ProductoListItem[] = [];
  let categorias: Categoria[] = [];
  let errorApi = false;

  try {
    const [page, cats] = await Promise.all([
      getProductos({ destacado: true, limit: 8 }),
      getCategorias(),
    ]);
    destacados = page.items;
    categorias = cats;
  } catch {
    errorApi = true;
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-primary/10 via-background to-background p-8 text-center sm:p-12">
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Tu ritual de belleza, en un solo lugar
        </h1>
        <p className="mx-auto mt-3 max-w-md text-pretty text-muted-foreground">
          Cosmética y cuidado personal seleccionados. Compra fácil, con o sin
          cuenta.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/productos">Ver productos</Link>
        </Button>
      </section>

      {errorApi ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No pudimos cargar el catálogo. ¿Está corriendo el backend en{" "}
          <code className="text-foreground">:8000</code>?
        </p>
      ) : (
        <>
          {/* Categorías */}
          {categorias.length > 0 && (
            <section className="flex flex-wrap gap-2">
              {categorias.map((c) => (
                <Button key={c.id} asChild variant="outline" size="sm">
                  <Link href={`/productos?categoria=${c.slug}`}>{c.nombre}</Link>
                </Button>
              ))}
            </section>
          )}

          {/* Destacados */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Destacados</h2>
              <Link
                href="/productos"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Ver todo →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {destacados.map((p) => (
                <ProductCard key={p.id} producto={p} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
