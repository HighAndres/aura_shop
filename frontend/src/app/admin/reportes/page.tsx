"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import * as admin from "@/lib/admin-client";
import { formatMXN } from "@/lib/format";
import { esAdministrador } from "@/lib/roles";
import type { StockBajoItem, TopProducto, VentasResumen } from "@/lib/types";

export default function ReportesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!authLoading && !esAdministrador(user)) router.replace("/admin/pedidos");
  }, [authLoading, user, router]);

  const [ventas, setVentas] = useState<VentasResumen | null>(null);
  const [top, setTop] = useState<TopProducto[]>([]);
  const [bajo, setBajo] = useState<StockBajoItem[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      admin.fetchVentas(),
      admin.fetchTopProductos(5),
      admin.fetchStockBajo(10),
    ])
      .then(([v, t, b]) => {
        setVentas(v);
        setTop(t);
        setBajo(b);
      })
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      {/* Ventas */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Pedidos</p>
          <p className="text-2xl font-semibold">{ventas?.num_pedidos ?? 0}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Ingresos</p>
          <p className="text-2xl font-semibold">{formatMXN(ventas?.ingresos ?? 0)}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Ticket promedio</p>
          <p className="text-2xl font-semibold">
            {formatMXN(ventas?.ticket_promedio ?? 0)}
          </p>
        </div>
      </section>

      {ventas && Object.keys(ventas.por_estado).length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {Object.entries(ventas.por_estado).map(([estado, n]) => (
            <span
              key={estado}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize text-secondary-foreground"
            >
              {estado}: {n}
            </span>
          ))}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top productos */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Productos más vendidos</h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">SKU</th>
                  <th className="p-3 font-medium">Cant.</th>
                  <th className="p-3 font-medium">Ingreso</th>
                </tr>
              </thead>
              <tbody>
                {top.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-muted-foreground">
                      Sin ventas aún.
                    </td>
                  </tr>
                ) : (
                  top.map((t) => (
                    <tr key={t.sku} className="border-b last:border-0">
                      <td className="p-3">{t.sku}</td>
                      <td className="p-3">{t.cantidad}</td>
                      <td className="p-3">{formatMXN(t.ingreso)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Stock bajo */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Stock bajo (≤ 10)</h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">SKU</th>
                  <th className="p-3 font-medium">Producto</th>
                  <th className="p-3 font-medium">Disp.</th>
                </tr>
              </thead>
              <tbody>
                {bajo.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-muted-foreground">
                      Todo con buen stock.
                    </td>
                  </tr>
                ) : (
                  bajo.map((b) => (
                    <tr key={b.sku} className="border-b last:border-0">
                      <td className="p-3">{b.sku}</td>
                      <td className="p-3 text-muted-foreground">{b.producto}</td>
                      <td
                        className={
                          b.disponible <= 0
                            ? "p-3 font-semibold text-destructive"
                            : "p-3"
                        }
                      >
                        {b.disponible}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
