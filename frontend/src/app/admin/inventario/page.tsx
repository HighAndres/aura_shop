"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminFetch } from "@/lib/admin-api";
import type { Almacen, Movimiento, StockItem } from "@/lib/types";

export default function AdminInventarioPage() {
  const { user } = useAuth();
  const canAdjust = user?.roles.some((r) =>
    ["superadmin", "administrador"].includes(r),
  );

  const [stock, setStock] = useState<StockItem[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAjuste, setShowAjuste] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filtros
  const [filtroSku, setFiltroSku] = useState("");

  // Form ajuste
  const [ajuste, setAjuste] = useState({
    sku: "",
    almacen: "",
    tipo: "entrada",
    cantidad: "",
    referencia: "",
    nota: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m, a] = await Promise.all([
        adminFetch<StockItem[]>("/inventory/stock"),
        adminFetch<Movimiento[]>("/inventory/movimientos?limit=100"),
        adminFetch<Almacen[]>("/inventory/almacenes"),
      ]);
      setStock(s);
      setMovimientos(m);
      setAlmacenes(a);
    } catch {
      /* permisos */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAjuste(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const cantidad = parseInt(ajuste.cantidad, 10);
      if (isNaN(cantidad) || cantidad === 0) {
        alert("La cantidad debe ser un número distinto de 0");
        return;
      }

      await adminFetch("/inventory/movimientos", {
        method: "POST",
        body: JSON.stringify({
          sku: ajuste.sku,
          almacen: ajuste.almacen,
          tipo: ajuste.tipo,
          cantidad:
            ajuste.tipo === "salida" ? -Math.abs(cantidad) : Math.abs(cantidad),
          referencia: ajuste.referencia || null,
          nota: ajuste.nota || null,
        }),
      });

      setShowAjuste(false);
      setAjuste({
        sku: "",
        almacen: "",
        tipo: "entrada",
        cantidad: "",
        referencia: "",
        nota: "",
      });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar movimiento");
    } finally {
      setSubmitting(false);
    }
  }

  const stockFiltrado = filtroSku
    ? stock.filter(
        (s) =>
          s.sku.toLowerCase().includes(filtroSku.toLowerCase()) ||
          s.producto.toLowerCase().includes(filtroSku.toLowerCase()),
      )
    : stock;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock actual y movimientos del ledger
          </p>
        </div>
        {canAdjust && (
          <Button onClick={() => setShowAjuste(true)} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Ajuste
          </Button>
        )}
      </div>

      <Tabs defaultValue="stock" className="mt-4">
        <TabsList>
          <TabsTrigger value="stock">Stock actual</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <div className="mt-2 mb-3">
            <Input
              placeholder="Filtrar por SKU o producto..."
              value={filtroSku}
              onChange={(e) => setFiltroSku(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : stockFiltrado.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Sin datos de stock
                    </TableCell>
                  </TableRow>
                ) : (
                  stockFiltrado.map((s, i) => (
                    <TableRow key={`${s.sku}-${s.almacen}-${i}`}>
                      <TableCell className="font-mono text-sm">{s.sku}</TableCell>
                      <TableCell className="text-sm">{s.producto}</TableCell>
                      <TableCell className="text-sm">
                        {s.almacen ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={
                            s.disponible > 0
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {s.disponible}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="movimientos">
          <div className="mt-2 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : movimientos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Sin movimientos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  movimientos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(m.fecha).toLocaleString("es-MX")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                      <TableCell className="text-sm">{m.almacen}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            m.tipo === "entrada"
                              ? "bg-green-100 text-green-800"
                              : m.tipo === "salida"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                          }
                        >
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm ${m.cantidad > 0 ? "text-green-700" : "text-red-700"}`}
                      >
                        {m.cantidad > 0 ? "+" : ""}
                        {m.cantidad}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.referencia ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.nota ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog ajuste */}
      <Dialog open={showAjuste} onOpenChange={setShowAjuste}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimiento de inventario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAjuste} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  required
                  value={ajuste.sku}
                  onChange={(e) =>
                    setAjuste({ ...ajuste, sku: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="almacen">Almacén</Label>
                <Select
                  value={ajuste.almacen}
                  onValueChange={(v) =>
                    setAjuste({ ...ajuste, almacen: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {almacenes.map((a) => (
                      <SelectItem key={a.id} value={a.codigo}>
                        {a.nombre} ({a.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={ajuste.tipo}
                  onValueChange={(v) =>
                    setAjuste({ ...ajuste, tipo: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="salida">Salida</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input
                  id="cantidad"
                  type="number"
                  required
                  min={1}
                  value={ajuste.cantidad}
                  onChange={(e) =>
                    setAjuste({ ...ajuste, cantidad: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="referencia">Referencia</Label>
              <Input
                id="referencia"
                value={ajuste.referencia}
                onChange={(e) =>
                  setAjuste({ ...ajuste, referencia: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="nota">Nota</Label>
              <Input
                id="nota"
                value={ajuste.nota}
                onChange={(e) =>
                  setAjuste({ ...ajuste, nota: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAjuste(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Registrando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
