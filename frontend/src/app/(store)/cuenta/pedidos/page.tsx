"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Package } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMisPedidos } from "@/lib/cart-client";
import { formatMXN } from "@/lib/format";
import type { Pedido } from "@/lib/types";

export default function MisPedidosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (user) {
      fetchMisPedidos()
        .then(setPedidos)
        .catch(() => setPedidos([]));
    }
  }, [loading, user, router]);

  if (loading || !user || pedidos === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Mis pedidos</h1>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Mis pedidos</h1>

      {pedidos.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Package className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Aún no tienes pedidos.
          </p>
          <Button asChild className="mt-4">
            <Link href="/productos">Ver productos</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => (
            <li key={p.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.numero}</span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
                  {p.estado}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                · {p.items.reduce((n, it) => n + it.cantidad, 0)} art. ·{" "}
                <span className="font-medium text-foreground">
                  {formatMXN(p.total)}
                </span>
              </p>
              <ul className="mt-2 text-sm text-muted-foreground">
                {p.items.map((it, i) => (
                  <li key={i} className="truncate">
                    {it.cantidad}× {it.nombre}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
