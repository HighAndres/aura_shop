import { Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatMXN } from "@/lib/format";
import type { ProductoListItem } from "@/lib/types";

export function ProductCard({ producto }: { producto: ProductoListItem }) {
  return (
    <Link
      href={`/productos/${producto.slug}`}
      className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative aspect-square bg-muted">
          {producto.imagen ? (
            <Image
              src={producto.imagen}
              alt={producto.nombre}
              fill
              sizes="(max-width: 640px) 50vw, 240px"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
          {producto.destacado ? (
            <Badge className="absolute left-2 top-2">Destacado</Badge>
          ) : null}
        </div>
        <CardContent className="space-y-1 p-3">
          {producto.marca ? (
            <p className="text-xs text-muted-foreground">{producto.marca}</p>
          ) : null}
          <h3 className="line-clamp-2 text-sm font-medium leading-tight">
            {producto.nombre}
          </h3>
          {producto.precio_desde ? (
            <p className="pt-1 text-sm font-semibold">
              desde {formatMXN(producto.precio_desde)}
            </p>
          ) : (
            <p className="pt-1 text-sm text-muted-foreground">Consultar precio</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
