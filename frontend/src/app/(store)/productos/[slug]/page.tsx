import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star } from "lucide-react";

import { AddToCart } from "@/components/add-to-cart";
import { Badge } from "@/components/ui/badge";
import { getProducto } from "@/lib/catalog";
import { formatMXN } from "@/lib/format";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const producto = await getProducto(params.slug).catch(() => null);
  if (!producto) return { title: "Producto no encontrado" };
  return {
    title: producto.nombre,
    description: producto.descripcion_corta ?? undefined,
  };
}

export default async function ProductoPage({ params }: PageProps) {
  const producto = await getProducto(params.slug);
  if (!producto) notFound();

  const imagen =
    producto.imagenes.find((i) => i.es_principal) ?? producto.imagenes[0];

  return (
    <div className="space-y-6">
      <Link
        href="/productos"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Volver a productos
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Imagen */}
        <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
          {imagen ? (
            <Image
              src={imagen.url}
              alt={imagen.alt ?? producto.nombre}
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-cover"
              priority
            />
          ) : null}
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div className="space-y-1">
            {producto.marca ? (
              <p className="text-sm text-muted-foreground">
                {producto.marca.nombre}
              </p>
            ) : null}
            <h1 className="text-2xl font-bold tracking-tight">
              {producto.nombre}
            </h1>
            {producto.num_resenas > 0 && producto.rating_promedio !== null ? (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="size-4 fill-primary text-primary" />
                {producto.rating_promedio} ({producto.num_resenas})
              </p>
            ) : null}
          </div>

          {producto.descripcion ? (
            <p className="text-pretty text-sm text-muted-foreground">
              {producto.descripcion}
            </p>
          ) : null}

          {/* Variantes */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Presentaciones</h2>
            <ul className="space-y-2">
              {producto.variantes.map((v) => {
                const agotado = v.disponible <= 0;
                return (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {v.nombre ??
                          v.atributos
                            .map((a) => `${a.atributo}: ${a.valor}`)
                            .join(" · ") ??
                          v.sku}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatMXN(v.precio)}
                        {v.precio_comparativo ? (
                          <span className="ml-2 text-xs line-through">
                            {formatMXN(v.precio_comparativo)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {agotado ? (
                      <Badge variant="secondary">Agotado</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {v.disponible} disp.
                        </span>
                        <AddToCart sku={v.sku} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
