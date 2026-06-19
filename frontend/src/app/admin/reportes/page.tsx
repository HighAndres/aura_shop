"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Package,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminFetch } from "@/lib/admin-api";
import { formatMXN } from "@/lib/format";
import type { VentasResumen, InventarioResumen } from "@/lib/types";

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ESTADO_COLORS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  pagado: "bg-blue-100 text-blue-800",
  enviado: "bg-purple-100 text-purple-800",
  entregado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

export default function AdminReportesPage() {
  const [dias, setDias] = useState("30");
  const [ventas, setVentas] = useState<VentasResumen | null>(null);
  const [inventario, setInventario] = useState<InventarioResumen | null>(null);
  const [loadingVentas, setLoadingVentas] = useState(true);
  const [loadingInv, setLoadingInv] = useState(true);

  useEffect(() => {
    setLoadingVentas(true);
    adminFetch<VentasResumen>(`/admin/reports/ventas?dias=${dias}`)
      .then(setVentas)
      .catch(() => setVentas(null))
      .finally(() => setLoadingVentas(false));
  }, [dias]);

  useEffect(() => {
    adminFetch<InventarioResumen>("/admin/reports/inventario")
      .then(setInventario)
      .catch(() => setInventario(null))
      .finally(() => setLoadingInv(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen de ventas e inventario
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Periodo:</span>
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
              <SelectItem value="365">Último año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- Ventas --- */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Ventas
        </h2>

        {loadingVentas ? (
          <p className="text-sm text-muted-foreground">Cargando ventas...</p>
        ) : ventas ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total ventas
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatMXN(ventas.total_ventas)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pedidos
                  </CardTitle>
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{ventas.total_pedidos}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ticket promedio
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatMXN(ventas.ticket_promedio)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Por estado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(ventas.por_estado).map(([estado, count]) => (
                      <Badge
                        key={estado}
                        variant="secondary"
                        className={ESTADO_COLORS[estado] ?? ""}
                      >
                        {ESTADO_LABELS[estado] ?? estado}: {count}
                      </Badge>
                    ))}
                    {Object.keys(ventas.por_estado).length === 0 && (
                      <span className="text-xs text-muted-foreground">Sin pedidos</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Productos top */}
            {ventas.productos_top.length > 0 && (
              <div className="rounded-md border mb-6">
                <div className="px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold">Productos más vendidos</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventas.productos_top.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium">{p.nombre}</TableCell>
                        <TableCell className="text-sm text-right">{p.cantidad}</TableCell>
                        <TableCell className="text-sm text-right">{formatMXN(p.ingresos)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Ventas diarias */}
            {ventas.ventas_diarias.length > 0 && (
              <div className="rounded-md border">
                <div className="px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold">Ventas por día</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventas.ventas_diarias.map((d) => (
                      <TableRow key={d.fecha}>
                        <TableCell className="text-sm">
                          {new Date(d.fecha + "T00:00:00").toLocaleDateString("es-MX", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-right">{d.pedidos}</TableCell>
                        <TableCell className="text-sm text-right">{formatMXN(d.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No se pudieron cargar los datos de ventas.</p>
        )}
      </section>

      {/* --- Inventario --- */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Inventario
        </h2>

        {loadingInv ? (
          <p className="text-sm text-muted-foreground">Cargando inventario...</p>
        ) : inventario ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total SKUs
                  </CardTitle>
                  <Package className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{inventario.total_skus}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Con stock
                  </CardTitle>
                  <Package className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{inventario.skus_con_stock}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Sin stock
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{inventario.skus_sin_stock}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Valor inventario
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatMXN(inventario.valor_inventario)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    Movimientos últimos 7 días
                  </p>
                  <p className="text-xl font-bold mt-1">{inventario.movimientos_recientes}</p>
                </CardContent>
              </Card>
            </div>

            {/* Stock bajo */}
            {inventario.stock_bajo.length > 0 && (
              <div className="rounded-md border">
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold">
                    Stock bajo o agotado ({inventario.stock_bajo.length} SKUs)
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Disponible</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventario.stock_bajo.map((s) => (
                      <TableRow key={s.sku}>
                        <TableCell className="text-sm font-mono">{s.sku}</TableCell>
                        <TableCell className="text-sm text-right">{s.disponible}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              s.disponible <= 0
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {s.disponible <= 0 ? "Agotado" : "Bajo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No se pudieron cargar los datos de inventario.</p>
        )}
      </section>
    </div>
  );
}
