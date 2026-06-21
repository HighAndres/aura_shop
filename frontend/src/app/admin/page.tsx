"use client";

import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Warehouse,
  Package,
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Plus,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/admin-api";
import { formatMXN } from "@/lib/format";
import type { PedidoPage, VentasResumen, InventarioResumen } from "@/lib/types";

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

function rolLabel(roles: string[]): string {
  if (roles.includes("superadmin")) return "Superadmin";
  if (roles.includes("administrador")) return "Administrador";
  if (roles.includes("vendedor")) return "Vendedor";
  return "Staff";
}

interface Stats {
  totalPedidos: number;
  pedidosPendientes: number;
  pedidosPagados: number;
  pedidosEnviados: number;
  skusConStock: number;
  skusSinStock: number;
  totalVentas: string;
  ticketPromedio: string;
  totalProductos: number;
  totalUsuarios: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperadmin = user?.roles.includes("superadmin");
  const isAdmin = user?.roles.includes("administrador") || isSuperadmin;
  const isVendedor = user?.roles.includes("vendedor");

  useEffect(() => {
    async function load() {
      const s: Stats = {
        totalPedidos: 0,
        pedidosPendientes: 0,
        pedidosPagados: 0,
        pedidosEnviados: 0,
        skusConStock: 0,
        skusSinStock: 0,
        totalVentas: "0",
        ticketPromedio: "0",
        totalProductos: 0,
        totalUsuarios: 0,
      };

      try {
        const [all, pend, pagados, enviados] = await Promise.all([
          adminFetch<PedidoPage>("/admin/orders?limit=1&offset=0"),
          adminFetch<PedidoPage>("/admin/orders?limit=1&offset=0&estado=pendiente"),
          adminFetch<PedidoPage>("/admin/orders?limit=1&offset=0&estado=pagado"),
          adminFetch<PedidoPage>("/admin/orders?limit=1&offset=0&estado=enviado"),
        ]);
        s.totalPedidos = all.total;
        s.pedidosPendientes = pend.total;
        s.pedidosPagados = pagados.total;
        s.pedidosEnviados = enviados.total;
      } catch {}

      try {
        const inv = await adminFetch<InventarioResumen>("/admin/reports/inventario");
        s.skusConStock = inv.skus_con_stock;
        s.skusSinStock = inv.skus_sin_stock;
      } catch {}

      if (isAdmin) {
        try {
          const ventas = await adminFetch<VentasResumen>("/admin/reports/ventas");
          s.totalVentas = ventas.total_ventas;
          s.ticketPromedio = ventas.ticket_promedio;
          s.totalProductos = ventas.total_pedidos;
        } catch {}

        try {
          const users = await adminFetch<{ total: number }>("/admin/users?limit=1");
          s.totalUsuarios = users.total;
        } catch {}
      }

      setStats(s);
      setLoading(false);
    }
    load();
  }, [isAdmin]);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-accent/20 p-6 sm:p-8 animate-fade-in">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground animate-fade-down">
              {saludo()}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight animate-fade-up" style={{ animationDelay: "0.1s", opacity: 0 }}>
              {user?.nombre_completo ?? user?.email}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "0.2s", opacity: 0 }}>
              {rolLabel(user?.roles ?? [])} · Panel de administración
            </p>
          </div>
          <div className="hidden sm:block animate-float">
            <Image
              src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&h=200&fit=crop&crop=center"
              alt="Beauty products"
              width={100}
              height={100}
              className="rounded-xl object-cover shadow-lg"
            />
          </div>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-accent/30 blur-3xl" />
      </div>

      {/* Stats cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Vendedor cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/admin/pedidos?estado=pendiente">
              <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-up" style={{ animationDelay: "0.1s", opacity: 0 }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pendientes
                  </CardTitle>
                  <Clock className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-amber-600">
                    {stats?.pedidosPendientes ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Requieren atención
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/pedidos?estado=pagado">
              <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-up" style={{ animationDelay: "0.15s", opacity: 0 }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pagados
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-600">
                    {stats?.pedidosPagados ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Listos para enviar
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/pedidos?estado=enviado">
              <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-up" style={{ animationDelay: "0.2s", opacity: 0 }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    En tránsito
                  </CardTitle>
                  <ShoppingCart className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-purple-600">
                    {stats?.pedidosEnviados ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pedidos enviados
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/inventario">
              <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-up" style={{ animationDelay: "0.25s", opacity: 0 }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Sin stock
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-600">
                    {stats?.skusSinStock ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SKUs agotados
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Admin-only: second row */}
          {isAdmin && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-up" style={{ animationDelay: "0.3s", opacity: 0 }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ventas del periodo
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {formatMXN(stats?.totalVentas ?? "0")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats?.totalPedidos ?? 0} pedidos en total
                  </p>
                </CardContent>
              </Card>

              <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-up" style={{ animationDelay: "0.35s", opacity: 0 }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ticket promedio
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatMXN(stats?.ticketPromedio ?? "0")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Por pedido
                  </p>
                </CardContent>
              </Card>

              <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-up" style={{ animationDelay: "0.4s", opacity: 0 }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Inventario activo
                  </CardTitle>
                  <Warehouse className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {stats?.skusConStock ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SKUs con existencia
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Quick actions */}
      <div className="animate-fade-up" style={{ animationDelay: "0.45s", opacity: 0 }}>
        <h2 className="text-lg font-semibold mb-3">Acciones rápidas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/admin/pedidos">
            <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Levantar pedido</p>
                  <p className="text-xs text-muted-foreground">
                    Crear pedido directamente con el cliente
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/productos">
            <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Package className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Gestionar productos</p>
                  <p className="text-xs text-muted-foreground">
                    Agregar, editar o consultar catálogo
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>

          {isAdmin && (
            <Link href="/admin/reportes">
              <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Ver reportes</p>
                    <p className="text-xs text-muted-foreground">
                      Ventas, inventario y métricas
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          )}

          {isSuperadmin && (
            <Link href="/admin/usuarios">
              <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Administrar usuarios</p>
                    <p className="text-xs text-muted-foreground">
                      Roles, permisos y cuentas
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
