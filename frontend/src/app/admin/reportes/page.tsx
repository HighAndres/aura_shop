"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Package,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Boxes,
  Activity,
  User,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
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
  confirmado: "Confirmado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ESTADO_COLORS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  pagado: "bg-blue-100 text-blue-800",
  confirmado: "bg-cyan-100 text-cyan-800",
  enviado: "bg-purple-100 text-purple-800",
  entregado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

function MiniBarChart({ data, maxVal }: { data: { label: string; value: number }[]; maxVal: number }) {
  if (data.length === 0) return null;
  const max = maxVal || 1;
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-primary/70 transition-all duration-500 hover:bg-primary min-h-[2px]"
            style={{
              height: `${Math.max((d.value / max) * 100, 2)}%`,
              animationDelay: `${i * 0.05}s`,
            }}
            title={`${d.label}: ${formatMXN(d.value)}`}
          />
          {data.length <= 14 && (
            <span className="text-[9px] text-muted-foreground truncate w-full text-center">
              {d.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  delay,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  delay: string;
}) {
  return (
    <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: delay }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminReportesPage() {
  const { user } = useAuth();
  const [dias, setDias] = useState("30");
  const [ventas, setVentas] = useState<VentasResumen | null>(null);
  const [inventario, setInventario] = useState<InventarioResumen | null>(null);
  const [loadingVentas, setLoadingVentas] = useState(true);
  const [loadingInv, setLoadingInv] = useState(true);

  const isSuperadmin = user?.roles.includes("superadmin");
  const isAdmin = user?.roles.includes("administrador") || isSuperadmin;
  const isVendedor = user?.roles.includes("vendedor") && !isAdmin;

  useEffect(() => {
    setLoadingVentas(true);
    adminFetch<VentasResumen>(`/admin/reports/ventas?dias=${dias}`)
      .then(setVentas)
      .catch(() => setVentas(null))
      .finally(() => setLoadingVentas(false));
  }, [dias]);

  useEffect(() => {
    if (!isVendedor) {
      adminFetch<InventarioResumen>("/admin/reports/inventario")
        .then(setInventario)
        .catch(() => setInventario(null))
        .finally(() => setLoadingInv(false));
    } else {
      setLoadingInv(false);
    }
  }, [isVendedor]);

  const diasLabel = dias === "7" ? "7 días" : dias === "30" ? "30 días" : dias === "90" ? "90 días" : "1 año";

  const headerDesc = isVendedor
    ? "Tu rendimiento personal y pedidos asignados"
    : isSuperadmin
      ? "Métricas globales de la tienda, ventas e inventario"
      : "Ventas, métricas e inventario de la tienda";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isVendedor ? "Mi rendimiento" : "Reportes"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{headerDesc}</p>
        </div>
        <div className="flex items-center gap-2">
          {isVendedor && (
            <Badge variant="outline" className="gap-1">
              <User className="h-3 w-3" />
              Mis datos
            </Badge>
          )}
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

      {/* ══════════════════════════════════════════════════════════
          VENDEDOR — Sección de rendimiento personal
         ══════════════════════════════════════════════════════════ */}
      {isVendedor && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Mis ventas
            <span className="text-sm font-normal text-muted-foreground">
              — Últimos {diasLabel}
            </span>
          </h2>

          {loadingVentas ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2"><div className="h-4 w-20 rounded bg-muted" /></CardHeader>
                  <CardContent><div className="h-8 w-24 rounded bg-muted" /></CardContent>
                </Card>
              ))}
            </div>
          ) : ventas ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                <StatCard
                  title="Pedidos levantados"
                  value={ventas.total_pedidos}
                  subtitle="Pedidos que yo gestioné"
                  icon={ShoppingCart}
                  iconColor="text-blue-600"
                  delay="0.05s"
                />
                <StatCard
                  title="Monto vendido"
                  value={formatMXN(ventas.total_ventas)}
                  subtitle={`Promedio: ${formatMXN(ventas.ticket_promedio)} por pedido`}
                  icon={DollarSign}
                  iconColor="text-green-600"
                  delay="0.1s"
                />
                <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.15s" }}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Mis pedidos por estado
                    </CardTitle>
                    <Activity className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(ventas.por_estado).map(([estado, count]) => (
                        <Badge
                          key={estado}
                          variant="secondary"
                          className={`${ESTADO_COLORS[estado] ?? ""} text-xs`}
                        >
                          {ESTADO_LABELS[estado] ?? estado}: {count}
                        </Badge>
                      ))}
                      {Object.keys(ventas.por_estado).length === 0 && (
                        <span className="text-xs text-muted-foreground">Sin pedidos en el periodo</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Gráfico de mis ventas por día */}
              {ventas.ventas_diarias.length > 0 && (
                <Card className="mb-6 animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.2s" }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Mis ventas por día
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart
                      data={ventas.ventas_diarias.map((d) => ({
                        label: new Date(d.fecha + "T00:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        }),
                        value: parseFloat(String(d.total)),
                      }))}
                      maxVal={Math.max(
                        ...ventas.ventas_diarias.map((d) => parseFloat(String(d.total))),
                      )}
                    />
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {new Date(ventas.periodo_inicio + "T00:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <span>
                        {new Date(ventas.periodo_fin + "T00:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Productos que más vendo */}
              {ventas.productos_top.length > 0 && (
                <div className="rounded-md border animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.25s" }}>
                  <div className="px-4 py-3 border-b flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Productos que más vendo</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ventas.productos_top.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                              i === 0
                                ? "bg-amber-100 text-amber-700"
                                : i === 1
                                  ? "bg-slate-100 text-slate-600"
                                  : i === 2
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-muted text-muted-foreground"
                            }`}>
                              {i + 1}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{p.nombre}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{p.cantidad}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {ventas.total_pedidos === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No tienes pedidos asignados en este periodo. Levanta un pedido desde la sección de Pedidos.
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No se pudieron cargar tus datos de ventas.
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          ADMIN / SUPERADMIN — Ventas globales de la tienda
         ══════════════════════════════════════════════════════════ */}
      {isAdmin && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Ventas de la tienda
            <span className="text-sm font-normal text-muted-foreground">
              — Últimos {diasLabel}
            </span>
          </h2>

          {loadingVentas ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2"><div className="h-4 w-20 rounded bg-muted" /></CardHeader>
                  <CardContent><div className="h-8 w-24 rounded bg-muted" /></CardContent>
                </Card>
              ))}
            </div>
          ) : ventas ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <StatCard
                  title="Ingresos totales"
                  value={formatMXN(ventas.total_ventas)}
                  subtitle={`${ventas.total_pedidos} pedidos`}
                  icon={DollarSign}
                  iconColor="text-green-600"
                  delay="0.05s"
                />
                <StatCard
                  title="Total pedidos"
                  value={ventas.total_pedidos}
                  subtitle="Sin cancelados"
                  icon={ShoppingCart}
                  iconColor="text-blue-600"
                  delay="0.1s"
                />
                <StatCard
                  title="Ticket promedio"
                  value={formatMXN(ventas.ticket_promedio)}
                  subtitle="Por pedido"
                  icon={BarChart3}
                  iconColor="text-purple-600"
                  delay="0.15s"
                />
                <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.2s" }}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Desglose por estado
                    </CardTitle>
                    <Activity className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(ventas.por_estado).map(([estado, count]) => (
                        <Badge
                          key={estado}
                          variant="secondary"
                          className={`${ESTADO_COLORS[estado] ?? ""} text-xs`}
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

              {/* Gráfico de ventas diarias */}
              {ventas.ventas_diarias.length > 0 && (
                <Card className="mb-6 animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.25s" }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Ingresos por día
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart
                      data={ventas.ventas_diarias.map((d) => ({
                        label: new Date(d.fecha + "T00:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        }),
                        value: parseFloat(String(d.total)),
                      }))}
                      maxVal={Math.max(
                        ...ventas.ventas_diarias.map((d) => parseFloat(String(d.total))),
                      )}
                    />
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {new Date(ventas.periodo_inicio + "T00:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <span>
                        {new Date(ventas.periodo_fin + "T00:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detalle por día */}
              {ventas.ventas_diarias.length > 0 && (
                <div className="rounded-md border mb-6 animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.3s" }}>
                  <div className="px-4 py-3 border-b">
                    <h3 className="text-sm font-semibold">Detalle por día</h3>
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
                          <TableCell className="text-sm text-right font-mono">
                            {formatMXN(d.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Productos más vendidos con ingresos */}
              {ventas.productos_top.length > 0 && (
                <div className="rounded-md border animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.35s" }}>
                  <div className="px-4 py-3 border-b flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Productos más vendidos</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ventas.productos_top.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                              i === 0
                                ? "bg-amber-100 text-amber-700"
                                : i === 1
                                  ? "bg-slate-100 text-slate-600"
                                  : i === 2
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-muted text-muted-foreground"
                            }`}>
                              {i + 1}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{p.nombre}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{p.cantidad}</TableCell>
                          <TableCell className="text-sm text-right font-mono">
                            {formatMXN(p.ingresos)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No se pudieron cargar los datos de ventas.
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          ADMIN / SUPERADMIN — Inventario
         ══════════════════════════════════════════════════════════ */}
      {isAdmin && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            Inventario
          </h2>

          {loadingInv ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2"><div className="h-4 w-20 rounded bg-muted" /></CardHeader>
                  <CardContent><div className="h-8 w-16 rounded bg-muted" /></CardContent>
                </Card>
              ))}
            </div>
          ) : inventario ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <StatCard
                  title="Total SKUs"
                  value={inventario.total_skus}
                  icon={Package}
                  iconColor="text-blue-600"
                  delay="0.4s"
                />
                <StatCard
                  title="Con stock"
                  value={inventario.skus_con_stock}
                  subtitle={inventario.total_skus > 0
                    ? `${Math.round((inventario.skus_con_stock / inventario.total_skus) * 100)}% del catálogo`
                    : undefined}
                  icon={Package}
                  iconColor="text-green-600"
                  delay="0.45s"
                />
                <StatCard
                  title="Sin stock"
                  value={inventario.skus_sin_stock}
                  subtitle={inventario.skus_sin_stock > 0 ? "Requieren reabastecimiento" : "Todo en orden"}
                  icon={AlertTriangle}
                  iconColor={inventario.skus_sin_stock > 0 ? "text-red-600" : "text-green-600"}
                  delay="0.5s"
                />
                <StatCard
                  title="Valor inventario"
                  value={formatMXN(inventario.valor_inventario)}
                  subtitle="A precio de venta"
                  icon={DollarSign}
                  iconColor="text-green-600"
                  delay="0.55s"
                />
              </div>

              {/* Cobertura visual */}
              {inventario.total_skus > 0 && (
                <Card className="mb-6 animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.6s" }}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Cobertura de inventario</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000"
                          style={{
                            width: `${(inventario.skus_con_stock / inventario.total_skus) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">
                        {Math.round((inventario.skus_con_stock / inventario.total_skus) * 100)}%
                      </span>
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-green-500" /> Con stock ({inventario.skus_con_stock})
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" /> Sin stock ({inventario.skus_sin_stock})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Movimientos */}
              <div className="grid gap-4 sm:grid-cols-2 mb-6 animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.65s" }}>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Activity className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Movimientos (últimos 7 días)
                        </p>
                        <p className="text-xl font-bold">{inventario.movimientos_recientes}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Stock bajo */}
              {inventario.stock_bajo.length > 0 && (
                <div className="rounded-md border animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: "0.7s" }}>
                  <div className="px-4 py-3 border-b flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-semibold">
                      Stock bajo o agotado
                    </h3>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {inventario.stock_bajo.length} SKUs
                    </Badge>
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
                          <TableCell className="text-sm text-right font-mono">
                            {s.disponible}
                          </TableCell>
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
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No se pudieron cargar los datos de inventario.
              </CardContent>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
