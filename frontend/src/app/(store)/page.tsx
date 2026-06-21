import Link from "next/link";
import { Sparkles } from "lucide-react";

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
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-secondary via-background to-accent/40 px-6 py-14 text-center sm:py-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/15">
          <Sparkles className="size-3.5" />
          Nueva temporada
        </span>
        <h1 className="mx-auto mt-5 max-w-2xl text-balance text-4xl font-semibold leading-[1.1] sm:text-5xl">
          Tu ritual de belleza, en un solo lugar
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
          Cosmética y cuidado personal seleccionados. Compra fácil, con o sin
          cuenta.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link href="/productos">Ver productos</Link>
          </Button>
        </div>
      </section>

      {errorApi ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No pudimos cargar los productos en este momento. Intenta de nuevo
          más tarde.
        </p>
      ) : (
        <>
          {/* Categorías */}
          {categorias.length > 0 && (
            <section className="flex flex-wrap justify-center gap-2">
              {categorias.map((c) => (
                <Button
                  key={c.id}
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  <Link href={`/productos?categoria=${c.slug}`}>{c.nombre}</Link>
                </Button>
              ))}
            </section>
          )}

          {/* Destacados */}
          <section className="space-y-5">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Destacados</h2>
                <p className="text-sm text-muted-foreground">
                  Lo más querido de la temporada
                </p>
              </div>
              <Link
                href="/productos"
                className="shrink-0 text-sm font-medium text-primary hover:underline"
              >
                Ver todo →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
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
