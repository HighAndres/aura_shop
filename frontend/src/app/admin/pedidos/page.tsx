"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  Minus,
  Loader2,
} from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminFetch } from "@/lib/admin-api";
import { formatMXN } from "@/lib/format";
import type {
  Pedido,
  PedidoPage,
  Usuario,
  ProductoAdmin,
  ProductoAdminPage,
  VarianteAdmin,
} from "@/lib/types";

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

interface LineaPedido {
  variante_id: string;
  sku: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

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
  const [staffUsers, setStaffUsers] = useState<Usuario[]>([]);

  /* ── Crear pedido ── */
  const [showCrear, setShowCrear] = useState(false);
  const [crearStep, setCrearStep] = useState<"productos" | "cliente">("productos");
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const [prodSearch, setProdSearch] = useState("");
  const [prodResults, setProdResults] = useState<ProductoAdmin[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [clienteData, setClienteData] = useState({
    email: "",
    nombre_contacto: "",
    telefono: "",
    direccion_calle: "",
    direccion_ciudad: "",
    direccion_estado: "",
    direccion_cp: "",
    notas: "",
  });
  const [creando, setCreando] = useState(false);
  const [crearError, setCrearError] = useState("");

  const canEdit = user?.roles.some((r) =>
    ["superadmin", "administrador", "vendedor"].includes(r),
  );
  const canCancel = user?.roles.some((r) =>
    ["superadmin", "administrador"].includes(r),
  );
  const canAssign = user?.roles.some((r) =>
    ["superadmin", "administrador"].includes(r),
  );
  const canCreate = user?.roles.some((r) =>
    ["superadmin", "administrador", "vendedor"].includes(r),
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

  useEffect(() => {
    if (!canAssign) return;
    adminFetch<{ items: Usuario[] }>("/admin/users?limit=200")
      .then((data) => {
        setStaffUsers(
          data.items.filter((u) =>
            u.roles.some((r) => ["superadmin", "administrador", "vendedor"].includes(r)),
          ),
        );
      })
      .catch(() => setStaffUsers([]));
  }, [canAssign]);

  /* ── Buscar productos ── */
  async function buscarProductos(q: string) {
    if (!q.trim()) {
      setProdResults([]);
      return;
    }
    setProdLoading(true);
    try {
      const res = await adminFetch<ProductoAdminPage>(
        `/admin/catalog/productos?q=${encodeURIComponent(q)}&activo=true&limit=10`,
      );
      setProdResults(res.items);
    } catch {
      setProdResults([]);
    } finally {
      setProdLoading(false);
    }
  }

  function agregarVariante(producto: ProductoAdmin, variante: VarianteAdmin) {
    const existe = lineas.find((l) => l.variante_id === variante.id);
    if (existe) {
      setLineas(
        lineas.map((l) =>
          l.variante_id === variante.id
            ? { ...l, cantidad: l.cantidad + 1 }
            : l,
        ),
      );
      return;
    }
    setLineas([
      ...lineas,
      {
        variante_id: variante.id,
        sku: variante.sku,
        nombre: `${producto.nombre}${variante.nombre ? ` — ${variante.nombre}` : ""}`,
        precio: parseFloat(variante.precio),
        cantidad: 1,
      },
    ]);
  }

  function quitarLinea(variante_id: string) {
    setLineas(lineas.filter((l) => l.variante_id !== variante_id));
  }

  function cambiarCantidad(variante_id: string, delta: number) {
    setLineas(
      lineas.map((l) => {
        if (l.variante_id !== variante_id) return l;
        return { ...l, cantidad: Math.max(1, l.cantidad + delta) };
      }),
    );
  }

  const totalNuevo = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);

  function resetCrear() {
    setShowCrear(false);
    setCrearStep("productos");
    setLineas([]);
    setProdSearch("");
    setProdResults([]);
    setClienteData({
      email: "",
      nombre_contacto: "",
      telefono: "",
      direccion_calle: "",
      direccion_ciudad: "",
      direccion_estado: "",
      direccion_cp: "",
      notas: "",
    });
    setCrearError("");
  }

  async function enviarPedido() {
    if (!clienteData.email || !clienteData.nombre_contacto) {
      setCrearError("Email y nombre son obligatorios");
      return;
    }
    setCreando(true);
    setCrearError("");
    try {
      await adminFetch("/admin/orders", {
        method: "POST",
        body: JSON.stringify({
          ...clienteData,
          items: lineas.map((l) => ({
            variante_id: l.variante_id,
            cantidad: l.cantidad,
          })),
        }),
      });
      resetCrear();
      await fetchPedidos();
    } catch (err) {
      setCrearError(err instanceof Error ? err.message : "Error al crear pedido");
    } finally {
      setCreando(false);
    }
  }

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

  async function reasignar(numero: string, asignadoA: string | null) {
    setUpdating(true);
    try {
      const res = await adminFetch<Pedido>(`/admin/orders/${numero}/asignar`, {
        method: "PUT",
        body: JSON.stringify({ asignado_a: asignadoA }),
      });
      setSelected(res);
      await fetchPedidos();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al reasignar");
    } finally {
      setUpdating(false);
    }
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de pedidos del marketplace
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCrear(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Pedido
          </Button>
        )}
      </div>

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
              <TableHead>Asignado a</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                  <TableCell className="text-sm text-muted-foreground">
                    {p.asignado_a_nombre ?? "—"}
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

      {/* ══════ Dialog DETALLE pedido ══════ */}
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
                <div>
                  <p className="text-muted-foreground">Asignado a</p>
                  <p>{selected.asignado_a_nombre ?? "Sin asignar"}</p>
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

              {/* Reasignar */}
              {canAssign && (
                <div>
                  <Label className="text-sm font-medium">Reasignar pedido</Label>
                  <Select
                    value={selected.asignado_a ?? "sin-asignar"}
                    onValueChange={(v) =>
                      reasignar(selected.numero, v === "sin-asignar" ? null : v)
                    }
                    disabled={updating}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sin-asignar">Sin asignar</SelectItem>
                      {staffUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nombre_completo || u.email}
                          <span className="ml-1 text-xs text-muted-foreground capitalize">
                            ({u.roles[0]})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

      {/* ══════ Dialog CREAR pedido ══════ */}
      <Dialog open={showCrear} onOpenChange={(open) => !open && resetCrear()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Levantar Pedido</DialogTitle>
          </DialogHeader>

          {/* Steps */}
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setCrearStep("productos")}
              className={`px-3 py-1 rounded-full transition-colors ${
                crearStep === "productos"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              1. Productos
            </button>
            <button
              onClick={() => lineas.length > 0 && setCrearStep("cliente")}
              className={`px-3 py-1 rounded-full transition-colors ${
                crearStep === "cliente"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              } ${lineas.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              2. Datos del cliente
            </button>
          </div>

          {crearStep === "productos" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto por nombre..."
                  value={prodSearch}
                  onChange={(e) => {
                    setProdSearch(e.target.value);
                    buscarProductos(e.target.value);
                  }}
                  className="pl-9"
                />
              </div>

              {prodLoading && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Buscando...
                </p>
              )}
              {prodResults.length > 0 && (
                <div className="rounded-md border max-h-60 overflow-y-auto">
                  {prodResults.map((prod) => (
                    <div key={prod.id}>
                      {prod.variantes
                        .filter((v) => v.activo && parseFloat(v.precio) > 0)
                        .map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                            onClick={() => {
                              agregarVariante(prod, v);
                              setProdSearch("");
                              setProdResults([]);
                            }}
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {prod.nombre}
                                {v.nombre && (
                                  <span className="text-muted-foreground">
                                    {" — "}
                                    {v.nombre}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                SKU: {v.sku}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono">
                                {formatMXN(v.precio)}
                              </span>
                              <Plus className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              )}

              {lineas.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Busca y agrega productos al pedido
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center w-32">Cantidad</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineas.map((l) => (
                        <TableRow key={l.variante_id}>
                          <TableCell>
                            <p className="text-sm">{l.nombre}</p>
                            <p className="text-xs text-muted-foreground">{l.sku}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => cambiarCantidad(l.variante_id, -1)}
                                disabled={l.cantidad <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm">
                                {l.cantidad}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => cambiarCantidad(l.variante_id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMXN(l.precio)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatMXN(l.precio * l.cantidad)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => quitarLinea(l.variante_id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between px-4 py-3 border-t font-medium">
                    <span>Total</span>
                    <span className="font-mono">{formatMXN(totalNuevo)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  disabled={lineas.length === 0}
                  onClick={() => setCrearStep("cliente")}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {crearStep === "cliente" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Email del cliente *</Label>
                  <Input
                    type="email"
                    value={clienteData.email}
                    onChange={(e) =>
                      setClienteData({ ...clienteData, email: e.target.value })
                    }
                    placeholder="cliente@correo.com"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Nombre completo *</Label>
                  <Input
                    value={clienteData.nombre_contacto}
                    onChange={(e) =>
                      setClienteData({
                        ...clienteData,
                        nombre_contacto: e.target.value,
                      })
                    }
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={clienteData.telefono}
                    onChange={(e) =>
                      setClienteData({ ...clienteData, telefono: e.target.value })
                    }
                    placeholder="10 dígitos"
                  />
                </div>
                <div>
                  <Label>C.P.</Label>
                  <Input
                    value={clienteData.direccion_cp}
                    onChange={(e) =>
                      setClienteData({
                        ...clienteData,
                        direccion_cp: e.target.value,
                      })
                    }
                    placeholder="00000"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Dirección</Label>
                  <Input
                    value={clienteData.direccion_calle}
                    onChange={(e) =>
                      setClienteData({
                        ...clienteData,
                        direccion_calle: e.target.value,
                      })
                    }
                    placeholder="Calle y número"
                  />
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <Input
                    value={clienteData.direccion_ciudad}
                    onChange={(e) =>
                      setClienteData({
                        ...clienteData,
                        direccion_ciudad: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input
                    value={clienteData.direccion_estado}
                    onChange={(e) =>
                      setClienteData({
                        ...clienteData,
                        direccion_estado: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Notas</Label>
                  <Input
                    value={clienteData.notas}
                    onChange={(e) =>
                      setClienteData({ ...clienteData, notas: e.target.value })
                    }
                    placeholder="Notas adicionales (opcional)"
                  />
                </div>
              </div>

              {/* Resumen */}
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm font-medium mb-2">
                  Resumen — {lineas.length} artículo(s)
                </p>
                {lineas.map((l) => (
                  <p key={l.variante_id} className="text-xs text-muted-foreground">
                    {l.cantidad}x {l.nombre} — {formatMXN(l.precio * l.cantidad)}
                  </p>
                ))}
                <p className="mt-2 text-sm font-medium">
                  Total: {formatMXN(totalNuevo)}
                </p>
              </div>

              {crearError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
                  {crearError}
                </p>
              )}

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCrearStep("productos")}
                >
                  Volver
                </Button>
                <Button onClick={enviarPedido} disabled={creando}>
                  {creando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Crear Pedido
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
