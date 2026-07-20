import { Gift } from "lucide-react";
import Image from "next/image";

import { AddBundleToCart } from "@/components/add-bundle-to-cart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatMXN } from "@/lib/format";
import type { PaquetePublico } from "@/lib/types";

export function BundleCard({ paquete }: { paquete: PaquetePublico }) {
  const ahorro = Number(paquete.ahorro);

  return (
    <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {paquete.imagen_url ? (
          <Image
            src={paquete.imagen_url}
            alt={paquete.nombre}
            fill
            sizes="(max-width: 640px) 100vw, 360px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Gift className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {ahorro > 0 ? (
          <Badge className="absolute left-2 top-2 shadow-sm">
            Ahorra {formatMXN(paquete.ahorro)}
          </Badge>
        ) : null}
      </div>
      <CardContent className="space-y-2 p-4">
        <h3 className="font-medium leading-tight">{paquete.nombre}</h3>
        {paquete.descripcion_corta ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {paquete.descripcion_corta}
          </p>
        ) : null}
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {paquete.items.map((item, i) => (
            <li key={i} className="flex items-baseline gap-1.5">
              <span className="text-xs">•</span>
              <span>
                {item.cantidad > 1 ? `${item.cantidad}× ` : ""}
                {item.producto_nombre}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-semibold">
              {formatMXN(paquete.precio_paquete)}
            </p>
            {ahorro > 0 ? (
              <p className="text-sm text-muted-foreground line-through">
                {formatMXN(paquete.precio_individual)}
              </p>
            ) : null}
          </div>
          <AddBundleToCart slug={paquete.slug} />
        </div>
      </CardContent>
    </Card>
  );
}
