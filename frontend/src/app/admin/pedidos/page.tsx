"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import * as admin from "@/lib/admin-client";
import { formatMXN } from "@/lib/format";
import { esAdministrador } from "@/lib/roles";
import type { PedidoAdminItem } from "@/lib/types";

const ESTADOS = ["pendiente", "pagado", "enviado", "entregado", "cancelado"];

// Siguiente estado "hacia adelante" según el actual.
const SIGUIENTE: Record<string, { estado: string; label: string } | null> = {
  pendiente: { estado: "pagado", label: "Marcar pagado" },
  pagado: { estado: "enviado", label: "Marcar enviado" },
  enviado: { estado: "entregado", label: "Marcar entregado" },
  entregado: null,
  cancelado: null,
};

function badgeClase(estado: string): string {
  switch (estado) {
    case "entregado":
      return "bg-primary/10 text-primary";
    case "cancelado":
      return "bg-destructive/10 text-destructive";
    case "pendiente":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-accent text-accent-foreground";
  }
}

export default function AdminPedidosPage() {
  const { user } = useAuth();
  const puedeCancelar = esAdministrador(user);
  const [pedidos, setPedidos] = useState<PedidoAdminItem[] | null>(null);
  const [filtro, setFiltro] = useState("");
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const page = await admin.fetchPedidos(filtro ? { estado: filtro } : {});
    setPedidos(page.items);
  }, [filtro]);

  useEffect(() => {
    cargar().catch(() => setPedidos([]));
  }, [cargar]);

  async function avanzar(numero: string, estado: string) {
    setTrabajando(numero);
    try {
      await admin.cambiarEstadoPedido(numero, estado);
      await cargar();
    } finally {
      setTrabajando(null);
    }
  }

  async function cancelar(numero: string) {
    setTrabajando(numero);
    try {
      await admin.cancelarPedido(numero);
      await cargar();
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <Button
          size="sm"
          variant={filtro === "" ? "default" : "outline"}
          onClick={() => setFiltro("")}
        >
          Todos
        </Button>
        {ESTADOS.map((e) => (
          <Button
            key={e}
            size="sm"
            variant={filtro === e ? "default" : "outline"}
            className="capitalize"
            onClick={() => setFiltro(e)}
          >
            {e}
          </Button>
        ))}
      </div>

      {pedidos === null ? (
        <Skeleton className="h-48 w-full" />
      ) : pedidos.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay pedidos {filtro ? `en estado “${filtro}”` : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Pedido</th>
                <th className="p-3 font-medium">Cliente</th>
                <th className="p-3 font-medium">Total</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const siguiente = SIGUIENTE[p.estado];
                const ocupado = trabajando === p.numero;
                return (
                  <tr key={p.id} className="border-b align-top last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{p.numero}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("es-MX")} ·{" "}
                        {p.num_items} art.
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.email}</td>
                    <td className="p-3 font-medium">{formatMXN(p.total)}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${badgeClase(
                          p.estado,
                        )}`}
                      >
                        {p.estado}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {siguiente ? (
                          <Button
                            size="sm"
                            disabled={ocupado}
                            onClick={() => avanzar(p.numero, siguiente.estado)}
                          >
                            {siguiente.label}
                          </Button>
                        ) : null}
                        {puedeCancelar &&
                        (p.estado === "pendiente" || p.estado === "pagado") ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={ocupado}
                            className="text-destructive hover:text-destructive"
                            onClick={() => cancelar(p.numero)}
                          >
                            Cancelar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
