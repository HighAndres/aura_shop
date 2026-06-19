"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Star,
  Search,
  Gift,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminFetch } from "@/lib/admin-api";
import { formatMXN } from "@/lib/format";
import type {
  PaqueteAdmin,
  PaqueteAdminPage,
  ProductoAdmin,
  ProductoAdminPage,
} from "@/lib/types";

const PAGE_SIZE = 20;

interface ItemForm {
  producto_id: string;
  variante_id: string;
  cantidad: number;
  orden: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminPaquetesPage() {
  const { user } = useAuth();
  const canDelete = user?.roles.some((r) => r === "superadmin") ?? false;

  const [data, setData] = useState<PaqueteAdminPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [offset, setOffset] = useState(0);

  const [productos, setProductos] = useState<ProductoAdmin[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [descripcionCorta, setDescripcionCorta] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [precioPaquete, setPrecioPaquete] = useState("");
  const [destacado, setDestacado] = useState(false);
  const [precioEspecial, setPrecioEspecial] = useState(true);
  const [items, setItems] = useState<ItemForm[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (busqueda) params.set("q", busqueda);
      const page = await adminFetch<PaqueteAdminPage>(
        `/admin/paquetes?${params.toString()}`,
      );
      setData(page);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [offset, busqueda]);

  const fetchProductos = useCallback(async () => {
    try {
      const page = await adminFetch<ProductoAdminPage>(
        "/admin/catalog/productos?limit=200&activo=true",
      );
      setProductos(page.items);
    } catch {
      setProductos([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchProductos();
  }, [fetchData, fetchProductos]);

  function resetForm() {
    setEditingId(null);
    setNombre("");
    setSlug("");
    setDescripcion("");
    setDescripcionCorta("");
    setImagenUrl("");
    setPrecioPaquete("");
    setDestacado(false);
    setPrecioEspecial(true);
    setItems([]);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(p: PaqueteAdmin) {
    setEditingId(p.id);
    setNombre(p.nombre);
    setSlug(p.slug);
    setDescripcion(p.descripcion ?? "");
    setDescripcionCorta(p.descripcion_corta ?? "");
    setImagenUrl(p.imagen_url ?? "");
    setPrecioPaquete(p.precio_paquete);
    setDestacado(p.destacado);
    setPrecioEspecial(Number(p.precio_paquete) !== Number(p.precio_individual));
    setItems(
      p.items.map((i) => ({
        producto_id: i.producto_id,
        variante_id: i.variante_id ?? "",
        cantidad: i.cantidad,
        orden: i.orden,
      })),
    );
    setShowForm(true);
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { producto_id: "", variante_id: "", cantidad: 1, orden: prev.length },
    ]);
  }

  function updateItem(idx: number, field: string, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        if (field === "producto_id") updated.variante_id = "";
        return updated;
      }),
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function getPrecioIndividual(): number {
    let total = 0;
    for (const item of items) {
      const prod = productos.find((p) => p.id === item.producto_id);
      if (!prod) continue;
      if (item.variante_id) {
        const v = prod.variantes.find((v) => v.id === item.variante_id);
        if (v) total += Number(v.precio) * item.cantidad;
      } else if (prod.variantes.length > 0) {
        const precios = prod.variantes.filter((v) => v.activo).map((v) => Number(v.precio));
        if (precios.length > 0) total += Math.min(...precios) * item.cantidad;
      }
    }
    return total;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (items.length === 0) {
      alert("Agrega al menos un producto al paquete");
      return;
    }

    const emptyProduct = items.findIndex((i) => !i.producto_id);
    if (emptyProduct !== -1) {
      alert(`Selecciona un producto para el item ${emptyProduct + 1}`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nombre,
        slug,
        descripcion: descripcion || null,
        descripcion_corta: descripcionCorta || null,
        imagen_url: imagenUrl || null,
        precio_paquete: precioEspecial ? (precioPaquete || "0") : String(precioInd),
        destacado,
        items: items.map((i) => ({
          producto_id: i.producto_id,
          variante_id: i.variante_id || null,
          cantidad: i.cantidad,
          orden: i.orden,
        })),
      };

      if (editingId) {
        await adminFetch(`/admin/paquetes/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/admin/paquetes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setShowForm(false);
      resetForm();
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActivo(p: PaqueteAdmin) {
    try {
      await adminFetch(`/admin/paquetes/${p.id}/activar`, { method: "PATCH" });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  async function eliminar(p: PaqueteAdmin) {
    if (!confirm(`¿Eliminar el paquete "${p.nombre}"? Esta acción no se puede deshacer.`))
      return;
    try {
      await adminFetch(`/admin/paquetes/${p.id}`, { method: "DELETE" });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const precioInd = getPrecioIndividual();
  const ahorro = precioInd - Number(precioPaquete || 0);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Paquetes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arma combos de productos con precio especial
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Paquete
        </Button>
      </div>

      <div className="mt-4 mb-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paquete..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setOffset(0); }}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Precio individual</TableHead>
              <TableHead>Precio paquete</TableHead>
              <TableHead>Ahorro</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
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
                  <div className="flex flex-col items-center gap-2">
                    <Gift className="h-8 w-8 text-muted-foreground/50" />
                    <span>No hay paquetes todavía</span>
                    <Button size="sm" variant="outline" onClick={openCreate}>
                      Crear primer paquete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.nombre}</span>
                      {p.destacado && (
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{p.slug}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.items.length} producto(s)
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground line-through">
                    {formatMXN(Number(p.precio_individual))}
                  </TableCell>
                  <TableCell className="text-sm font-mono font-semibold">
                    {formatMXN(Number(p.precio_paquete))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      -{formatMXN(Number(p.ahorro))}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        p.activo
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {p.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(p)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleActivo(p)}
                        title={p.activo ? "Desactivar" : "Activar"}
                      >
                        {p.activo ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-amber-600" />
                        )}
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => eliminar(p)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{data?.total} paquete(s) · Página {currentPage} de {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Dialog crear/editar paquete */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar paquete" : "Nuevo paquete"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paq-nombre">Nombre</Label>
                <Input
                  id="paq-nombre"
                  required
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    if (!editingId) setSlug(slugify(e.target.value));
                  }}
                  placeholder="Ej: Kit Cuidado Facial"
                />
              </div>
              <div>
                <Label htmlFor="paq-slug">Slug</Label>
                <Input
                  id="paq-slug"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="paq-desc-corta">Descripción corta</Label>
              <Input
                id="paq-desc-corta"
                value={descripcionCorta}
                onChange={(e) => setDescripcionCorta(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="paq-desc">Descripción</Label>
              <Textarea
                id="paq-desc"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="paq-img">URL de imagen</Label>
              <Input
                id="paq-img"
                value={imagenUrl}
                onChange={(e) => setImagenUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* Productos del paquete */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Productos del paquete</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-4 w-4" />
                  Agregar producto
                </Button>
              </div>

              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                  Agrega productos para armar el paquete
                </p>
              )}

              <div className="space-y-3">
                {items.map((item, idx) => {
                  const prod = productos.find((p) => p.id === item.producto_id);
                  return (
                    <div key={idx} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Producto {idx + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeItem(idx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <Label className="text-xs">Producto</Label>
                          <Select
                            value={item.producto_id}
                            onValueChange={(v) => updateItem(idx, "producto_id", v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {productos.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Cantidad</Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.cantidad}
                            onChange={(e) =>
                              updateItem(idx, "cantidad", parseInt(e.target.value) || 1)
                            }
                          />
                        </div>
                      </div>
                      {prod && prod.variantes.length > 1 && (
                        <div>
                          <Label className="text-xs">Variante (opcional)</Label>
                          <Select
                            value={item.variante_id || "any"}
                            onValueChange={(v) =>
                              updateItem(idx, "variante_id", v === "any" ? "" : v)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Cualquier variante" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Cualquier variante</SelectItem>
                              {prod.variantes
                                .filter((v) => v.activo)
                                .map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.nombre || v.sku} — {formatMXN(Number(v.precio))}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Precios */}
            <div className="rounded-md border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="paq-precio-especial"
                  checked={precioEspecial}
                  onChange={(e) => {
                    setPrecioEspecial(e.target.checked);
                    if (!e.target.checked) setPrecioPaquete(String(precioInd));
                  }}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="paq-precio-especial">Precio especial (descuento por paquete)</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Precio individual (suma)</Label>
                  <p className={`text-lg font-mono ${precioEspecial ? "line-through text-muted-foreground" : ""}`}>
                    {formatMXN(precioInd)}
                  </p>
                </div>
                {precioEspecial ? (
                  <div>
                    <Label htmlFor="paq-precio">Precio del paquete (MXN)</Label>
                    <Input
                      id="paq-precio"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={precioPaquete}
                      onChange={(e) => setPrecioPaquete(e.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <Label className="text-muted-foreground text-xs">Precio del paquete</Label>
                    <p className="text-lg font-mono">
                      {formatMXN(precioInd)}
                    </p>
                    <p className="text-xs text-muted-foreground">Sin descuento</p>
                  </div>
                )}
              </div>
              {precioEspecial && Number(precioPaquete) > 0 && ahorro > 0 && precioInd > 0 && (
                <p className="text-sm font-medium text-green-700">
                  Ahorro para el cliente: {formatMXN(ahorro)} ({Math.round((ahorro / precioInd) * 100)}% de descuento)
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="paq-destacado"
                checked={destacado}
                onChange={(e) => setDestacado(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="paq-destacado">Paquete destacado</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowForm(false); resetForm(); }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear paquete"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
