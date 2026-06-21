import Link from "next/link";
import Image from "next/image";
import { Sparkles, ArrowRight, Star } from "lucide-react";

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
    <div className="space-y-16">
      {/* Hero with image */}
      <section className="relative overflow-hidden rounded-3xl border">
        <div className="grid md:grid-cols-2">
          {/* Text */}
          <div className="flex flex-col justify-center px-8 py-14 sm:px-12 sm:py-20 bg-gradient-to-br from-secondary via-background to-accent/30">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20 animate-fade-down">
              <Sparkles className="size-3.5" />
              Nueva temporada
            </span>
            <h1 className="mt-5 max-w-lg text-balance text-4xl font-semibold leading-[1.1] sm:text-5xl animate-fade-up [animation-delay:0.1s] opacity-0 [animation-fill-mode:forwards]">
              Tu ritual de belleza, en un solo lugar
            </h1>
            <p className="mt-4 max-w-md text-pretty text-muted-foreground animate-fade-up [animation-delay:0.2s] opacity-0 [animation-fill-mode:forwards]">
              Cosmética y cuidado personal seleccionados. Compra fácil, con o sin
              cuenta.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 animate-fade-up [animation-delay:0.3s] opacity-0 [animation-fill-mode:forwards]">
              <Button asChild size="lg" className="rounded-full px-8 group">
                <Link href="/productos">
                  Ver productos
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap gap-6 text-xs text-muted-foreground animate-fade-up [animation-delay:0.4s] opacity-0 [animation-fill-mode:forwards]">
              <span className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                Productos originales
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                Envío seguro
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                Atención personalizada
              </span>
            </div>
          </div>

          {/* Image */}
          <div className="relative hidden md:block min-h-[400px]">
            <Image
              src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=600&fit=crop&crop=center"
              alt="Productos de belleza Aura"
              fill
              priority
              sizes="50vw"
              className="object-cover animate-fade-in [animation-delay:0.2s] opacity-0 [animation-fill-mode:forwards]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/50 to-transparent" />
          </div>
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
            <section className="flex flex-wrap justify-center gap-2 animate-fade-up [animation-delay:0.3s] opacity-0 [animation-fill-mode:forwards]">
              {categorias.map((c, i) => (
                <Button
                  key={c.id}
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full transition-all hover:scale-105 hover:shadow-md"
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
                className="group shrink-0 text-sm font-medium text-primary hover:underline flex items-center gap-1"
              >
                Ver todo
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {destacados.map((p, i) => (
                <div
                  key={p.id}
                  className="animate-fade-up opacity-0 [animation-fill-mode:forwards]"
                  style={{ animationDelay: `${0.1 + i * 0.07}s` }}
                >
                  <ProductCard producto={p} />
                </div>
              ))}
            </div>
          </section>

          {/* CTA banner */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 px-8 py-12 text-center text-primary-foreground animate-fade-up [animation-delay:0.5s] opacity-0 [animation-fill-mode:forwards]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl font-semibold sm:text-3xl">
              Encuentra tu producto ideal
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-primary-foreground/80">
              Explora nuestra colección completa de productos de belleza y cuidado personal
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="relative mt-6 rounded-full px-8 group"
            >
              <Link href="/productos">
                Explorar catálogo
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
