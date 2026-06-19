"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Warehouse } from "lucide-react";
import Link from "next/link";

import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminFetch } from "@/lib/admin-api";
import type { PedidoPage, StockItem } from "@/lib/types";

interface DashboardStats {
  totalPedidos: number;
  pedidosPendientes: number;
  skusConStock: number;
  skusSinStock: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    async function load() {
      const s: DashboardStats = {
        totalPedidos: 0,
        pedidosPendientes: 0,
        skusConStock: 0,
        skusSinStock: 0,
      };

      try {
        const pedidos = await adminFetch<PedidoPage>(
          "/admin/orders?limit=1&offset=0",
        );
        s.totalPedidos = pedidos.total;

        const pendientes = await adminFetch<PedidoPage>(
          "/admin/orders?limit=1&offset=0&estado=pendiente",
        );
        s.pedidosPendientes = pendientes.total;
      } catch {
        /* sin permiso de pedidos */
      }

      try {
        const stock = await adminFetch<StockItem[]>("/inventory/stock");
        s.skusConStock = stock.filter((i) => i.disponible > 0).length;
        s.skusSinStock = stock.filter((i) => i.disponible <= 0).length;
      } catch {
        /* sin permiso de inventario */
      }

      setStats(s);
    }

    load();
  }, []);

  const cards = [
    {
      title: "Pedidos totales",
      value: stats?.totalPedidos ?? "—",
      icon: ShoppingCart,
      href: "/admin/pedidos",
      color: "text-blue-600",
    },
    {
      title: "Pendientes",
      value: stats?.pedidosPendientes ?? "—",
      icon: ShoppingCart,
      href: "/admin/pedidos?estado=pendiente",
      color: "text-amber-600",
    },
    {
      title: "SKUs con stock",
      value: stats?.skusConStock ?? "—",
      icon: Warehouse,
      href: "/admin/inventario",
      color: "text-green-600",
    },
    {
      title: "SKUs sin stock",
      value: stats?.skusSinStock ?? "—",
      icon: Warehouse,
      href: "/admin/inventario",
      color: "text-red-600",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Bienvenido, {user?.nombre_completo ?? user?.email}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Panel de administración de Aura
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{card.value}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
