"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminFetch } from "@/lib/admin-api";
import { formatMXN } from "@/lib/format";
import type { Pedido, PedidoPage } from "@/lib/types";

const ESTADOS = ["", "pendiente", "pagado", "enviado", "entregado", "cancelado"];

const ESTADO_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  pagado: "bg-blue-100 text-blue-800",
  enviado: "bg-purple-100 text-purple-800",
  entregado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

const TRANSICIONES: Record<string, string[]> = {
  pendiente: ["pagado", "cancelado"],
  pagado: ["enviado", "cancelado"],
  enviado: ["entregado"],
  entregado: [],
  cancelado: [],
};

const PAGE_SIZE = 20;

export default function AdminPedidosPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [data, setData] = useState<PedidoPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState(
    searchParams.get("estado") ?? "",
  );
  const [busqueda, setBusqueda] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Pedido | null>(null);
  const [updating, setUpdating] = useState(false);

  const canEdit = user?.roles.some((r) =>
    ["superadmin", "administrador", "vendedor"].includes(r),
  );
  const canCancel = user?.roles.some((r) =>
    ["superadmin", "administrador"].includes(r),
  );

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (filtroEstado) params.set("estado", filtroEstado);
      if (busqueda) params.set("q", busqueda);

      const page = await adminFetch<PedidoPage>(
        `/admin/orders?${params.toString()}`,
      );
      setData(page);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [offset, filtroEstado, busqueda]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  async function cambiarEstado(numero: string, estado: string) {
    setUpdating(true);
    try {
      if (estado === "cancelado") {
        await adminFetch(`/admin/orders/${numero}/cancelar`, { method: "PUT" });
      } else {
        await adminFetch(`/admin/orders/${numero}/estado`, {
          method: "PUT",
          body: JSON.stringify({ estado }),
        });
      }
      await fetchPedidos();
      setSelected(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setUpdating(false);
    }
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gestión de pedidos del marketplace
      </p>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por número o email..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setOffset(0);
          }}
          className="max-w-xs"
        />
        <Select
          value={filtroEstado}
          onValueChange={(v) => {
            setFiltroEstado(v === "todos" ? "" : v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {ESTADOS.filter(Boolean).map((e) => (
              <SelectItem key={e} value={e} className="capitalize">
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron pedidos
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(p)}
                >
                  <TableCell className="font-mono text-sm">{p.numero}</TableCell>
                  <TableCell className="text-sm">{p.email}</TableCell>
                  <TableCell className="text-sm">{p.nombre_contacto}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={ESTADO_BADGE[p.estado] ?? ""}
                    >
                      {p.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatMXN(p.total)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("es-MX")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total} pedido(s) · Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog detalle */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedido {selected?.numero}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p>{selected.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contacto</p>
                  <p>{selected.nombre_contacto}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <Badge
                    variant="secondary"
                    className={ESTADO_BADGE[selected.estado] ?? ""}
                  >
                    {selected.estado}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p>{new Date(selected.created_at).toLocaleString("es-MX")}</p>
                </div>
                {selected.requiere_factura && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Facturación</p>
                    <p>RFC: {selected.rfc ?? "—"}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <p className="mb-2 text-sm font-medium">Artículos</p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Cant.</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.items.map((it) => (
                        <TableRow key={it.sku}>
                          <TableCell className="text-sm">
                            {it.nombre}
                            <span className="block text-xs text-muted-foreground">
                              {it.sku}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{it.cantidad}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMXN(it.precio_unitario)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMXN(it.subtotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-2 flex justify-between text-sm font-medium">
                  <span>Total</span>
                  <span className="font-mono">{formatMXN(selected.total)}</span>
                </div>
              </div>

              {/* Acciones de estado */}
              {(() => {
                const trans = TRANSICIONES[selected.estado] ?? [];
                const acciones = trans.filter((e) => {
                  if (e === "cancelado") return canCancel;
                  return canEdit;
                });
                if (acciones.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {acciones.map((e) => (
                      <Button
                        key={e}
                        size="sm"
                        variant={e === "cancelado" ? "destructive" : "default"}
                        disabled={updating}
                        onClick={() => cambiarEstado(selected.numero, e)}
                        className="capitalize"
                      >
                        {e === "cancelado" ? "Cancelar pedido" : `Marcar ${e}`}
                      </Button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
