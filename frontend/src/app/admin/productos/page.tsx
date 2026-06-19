"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  X,
  Star,
  Lock,
  Search,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFetch } from "@/lib/admin-api";
import { formatMXN } from "@/lib/format";
import type {
  ProductoAdmin,
  ProductoAdminPage,
  MarcaAdmin,
  CategoriaAdmin,
} from "@/lib/types";

const PAGE_SIZE = 20;
const PRICE_ROLES = ["superadmin", "administrador"];

interface VarianteForm {
  sku: string;
  nombre: string;
  precio: string;
  precio_comparativo: string;
  activo: boolean;
}

interface ImagenForm {
  url: string;
  alt: string;
  orden: number;
  es_principal: boolean;
}

const emptyVariante = (): VarianteForm => ({
  sku: "",
  nombre: "",
  precio: "",
  precio_comparativo: "",
  activo: true,
});

const emptyImagen = (): ImagenForm => ({
  url: "",
  alt: "",
  orden: 0,
  es_principal: false,
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminProductosPage() {
  const { user } = useAuth();

  const canPrice = user?.roles.some((r) => PRICE_ROLES.includes(r)) ?? false;
  const canDelete = user?.roles.some((r) => r === "superadmin") ?? false;
  const canManageCatalog = canPrice;

  const [data, setData] = useState<ProductoAdminPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [offset, setOffset] = useState(0);
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const [marcas, setMarcas] = useState<MarcaAdmin[]>([]);
  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formTab, setFormTab] = useState("general");

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [descripcionCorta, setDescripcionCorta] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [destacado, setDestacado] = useState(false);
  const [variantes, setVariantes] = useState<VarianteForm[]>([emptyVariante()]);
  const [imagenes, setImagenes] = useState<ImagenForm[]>([]);

  const [showMarcas, setShowMarcas] = useState(false);
  const [showCategorias, setShowCategorias] = useState(false);
  const [newMarcaNombre, setNewMarcaNombre] = useState("");
  const [newCategoriaNombre, setNewCategoriaNombre] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (busqueda) params.set("q", busqueda);
      if (filtroCategoria) params.set("categoria_id", filtroCategoria);

      const page = await adminFetch<ProductoAdminPage>(
        `/admin/catalog/productos?${params.toString()}`,
      );
      setData(page);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [offset, busqueda, filtroCategoria]);

  const fetchCatalogData = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([
        adminFetch<MarcaAdmin[]>("/admin/catalog/marcas"),
        adminFetch<CategoriaAdmin[]>("/admin/catalog/categorias"),
      ]);
      setMarcas(m);
      setCategorias(c);
    } catch {
      /* permisos */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchCatalogData();
  }, [fetchData, fetchCatalogData]);

  function resetForm() {
    setEditingId(null);
    setNombre("");
    setSlug("");
    setDescripcion("");
    setDescripcionCorta("");
    setMarcaId("");
    setCategoriaId("");
    setDestacado(false);
    setVariantes([emptyVariante()]);
    setImagenes([]);
    setFormTab("general");
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(p: ProductoAdmin) {
    setEditingId(p.id);
    setNombre(p.nombre);
    setSlug(p.slug);
    setDescripcion(p.descripcion ?? "");
    setDescripcionCorta(p.descripcion_corta ?? "");
    setMarcaId(p.marca_id ?? "");
    setCategoriaId(p.categoria_id ?? "");
    setDestacado(p.destacado);
    setVariantes(
      p.variantes.map((v) => ({
        sku: v.sku,
        nombre: v.nombre ?? "",
        precio: v.precio,
        precio_comparativo: v.precio_comparativo ?? "",
        activo: v.activo,
      })),
    );
    setImagenes(
      p.imagenes.map((img) => ({
        url: img.url,
        alt: img.alt ?? "",
        orden: img.orden,
        es_principal: img.es_principal,
      })),
    );
    setFormTab("general");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        nombre,
        slug,
        descripcion: descripcion || null,
        descripcion_corta: descripcionCorta || null,
        marca_id: marcaId && marcaId !== "none" ? marcaId : null,
        categoria_id: categoriaId && categoriaId !== "none" ? categoriaId : null,
        destacado,
        variantes: variantes.map((v) => ({
          sku: v.sku,
          nombre: v.nombre || null,
          precio: v.precio || "0",
          precio_comparativo: v.precio_comparativo || null,
          activo: v.activo,
        })),
        imagenes: imagenes.map((img) => ({
          url: img.url,
          alt: img.alt || null,
          orden: img.orden,
          es_principal: img.es_principal,
        })),
      };

      if (editingId) {
        await adminFetch(`/admin/catalog/productos/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/admin/catalog/productos", {
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

  async function toggleActivo(p: ProductoAdmin) {
    try {
      await adminFetch(`/admin/catalog/productos/${p.id}/activar`, {
        method: "PATCH",
      });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  async function eliminar(p: ProductoAdmin) {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`))
      return;
    try {
      await adminFetch(`/admin/catalog/productos/${p.id}`, {
        method: "DELETE",
      });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  async function crearMarca() {
    if (!newMarcaNombre.trim()) return;
    try {
      await adminFetch("/admin/catalog/marcas", {
        method: "POST",
        body: JSON.stringify({
          nombre: newMarcaNombre.trim(),
          slug: slugify(newMarcaNombre.trim()),
        }),
      });
      setNewMarcaNombre("");
      await fetchCatalogData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  async function crearCategoria() {
    if (!newCategoriaNombre.trim()) return;
    try {
      await adminFetch("/admin/catalog/categorias", {
        method: "POST",
        body: JSON.stringify({
          nombre: newCategoriaNombre.trim(),
          slug: slugify(newCategoriaNombre.trim()),
        }),
      });
      setNewCategoriaNombre("");
      await fetchCatalogData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  function updateVariante(idx: number, field: string, value: string | boolean) {
    setVariantes((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    );
  }

  function removeVariante(idx: number) {
    setVariantes((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateImagen(idx: number, field: string, value: string | number | boolean) {
    setImagenes((prev) =>
      prev.map((img, i) => (i === idx ? { ...img, [field]: value } : img)),
    );
  }

  function removeImagen(idx: number) {
    setImagenes((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const marcaNombre = (id: string | null) =>
    marcas.find((m) => m.id === id)?.nombre ?? "—";
  const categoriaNombre = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nombre ?? "—";

  const categoriasActivas = categorias.filter((c) => c.activo);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de productos, marcas y categorías
          </p>
        </div>
        <div className="flex gap-2">
          {canManageCatalog && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowMarcas(true)}>
                Marcas
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCategorias(true)}>
                Categorías
              </Button>
            </>
          )}
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Producto
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-4 mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setOffset(0);
            }}
            className="pl-8"
          />
        </div>
        {categoriasActivas.length > 0 && (
          <Select value={filtroCategoria} onValueChange={(v) => { setFiltroCategoria(v === "all" ? "" : v); setOffset(0); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categoriasActivas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Variantes</TableHead>
              <TableHead>Precio desde</TableHead>
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
                  No se encontraron productos
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((p) => {
                const precios = p.variantes
                  .filter((v) => v.activo)
                  .map((v) => Number(v.precio));
                const precioDesde = precios.length > 0 ? Math.min(...precios) : null;

                return (
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
                      {marcaNombre(p.marca_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {categoriaNombre(p.categoria_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.variantes.length}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {precioDesde !== null && precioDesde > 0
                        ? formatMXN(precioDesde)
                        : <span className="text-amber-600 text-xs">Sin precio</span>}
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
                        {p.activo ? "Activo" : "Borrador"}
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
                        {canPrice && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleActivo(p)}
                            title={p.activo ? "Pasar a borrador" : "Publicar"}
                          >
                            {p.activo ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-amber-600" />
                            )}
                          </Button>
                        )}
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total} producto(s) · Página {currentPage} de {totalPages}
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

      {/* Dialog crear/editar producto */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar producto" : "Nuevo producto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs value={formTab} onValueChange={setFormTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="variantes">
                  Variantes ({variantes.length})
                </TabsTrigger>
                <TabsTrigger value="imagenes">
                  Imágenes ({imagenes.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input
                      id="nombre"
                      required
                      value={nombre}
                      onChange={(e) => {
                        setNombre(e.target.value);
                        if (!editingId) setSlug(slugify(e.target.value));
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      required
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="desc-corta">Descripción corta</Label>
                  <Input
                    id="desc-corta"
                    value={descripcionCorta}
                    onChange={(e) => setDescripcionCorta(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    rows={3}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Marca</Label>
                    <Select value={marcaId} onValueChange={setMarcaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin marca" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin marca</SelectItem>
                        {marcas
                          .filter((m) => m.activo)
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nombre}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoría</Label>
                    <Select value={categoriaId} onValueChange={setCategoriaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoría</SelectItem>
                        {categoriasActivas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="destacado"
                    checked={destacado}
                    onChange={(e) => setDestacado(e.target.checked)}
                    disabled={!canPrice}
                    className="h-4 w-4 rounded border-input disabled:opacity-50"
                  />
                  <Label htmlFor="destacado" className={!canPrice ? "text-muted-foreground" : ""}>
                    Producto destacado
                  </Label>
                  {!canPrice && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                {!canPrice && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                    El producto se creará como borrador. Un administrador deberá asignar el precio y publicarlo.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="variantes" className="space-y-4">
                {!canPrice && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    Los campos de precio solo pueden ser editados por un administrador.
                  </p>
                )}
                {variantes.map((v, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Variante {idx + 1}
                      </span>
                      {variantes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeVariante(idx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>SKU</Label>
                        <Input
                          required
                          value={v.sku}
                          onChange={(e) =>
                            updateVariante(idx, "sku", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>Nombre</Label>
                        <Input
                          value={v.nombre}
                          placeholder="Ej: Tono Rojo, 30ml"
                          onChange={(e) =>
                            updateVariante(idx, "nombre", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label className={!canPrice ? "text-muted-foreground" : ""}>
                          Precio (MXN) {!canPrice && <Lock className="inline h-3 w-3 ml-1" />}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          required={canPrice}
                          value={canPrice ? v.precio : v.precio || "0"}
                          onChange={(e) =>
                            updateVariante(idx, "precio", e.target.value)
                          }
                          disabled={!canPrice}
                          className={!canPrice ? "bg-muted" : ""}
                        />
                      </div>
                      <div>
                        <Label className={!canPrice ? "text-muted-foreground" : ""}>
                          Precio comparativo {!canPrice && <Lock className="inline h-3 w-3 ml-1" />}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v.precio_comparativo}
                          onChange={(e) =>
                            updateVariante(
                              idx,
                              "precio_comparativo",
                              e.target.value,
                            )
                          }
                          disabled={!canPrice}
                          className={!canPrice ? "bg-muted" : ""}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={v.activo}
                        onChange={(e) =>
                          updateVariante(idx, "activo", e.target.checked)
                        }
                        disabled={!canPrice}
                        className="h-4 w-4 rounded border-input disabled:opacity-50"
                      />
                      <span className={`text-sm ${!canPrice ? "text-muted-foreground" : ""}`}>
                        Activa
                      </span>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setVariantes((prev) => [...prev, emptyVariante()])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Agregar variante
                </Button>
              </TabsContent>

              <TabsContent value="imagenes" className="space-y-4">
                {imagenes.map((img, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Imagen {idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeImagen(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label>URL</Label>
                        <Input
                          required
                          value={img.url}
                          onChange={(e) =>
                            updateImagen(idx, "url", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>Alt</Label>
                        <Input
                          value={img.alt}
                          onChange={(e) =>
                            updateImagen(idx, "alt", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>Orden</Label>
                        <Input
                          type="number"
                          value={img.orden}
                          onChange={(e) =>
                            updateImagen(idx, "orden", parseInt(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={img.es_principal}
                        onChange={(e) =>
                          updateImagen(idx, "es_principal", e.target.checked)
                        }
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm">Imagen principal</span>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setImagenes((prev) => [...prev, emptyImagen()])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Agregar imagen
                </Button>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Guardando..."
                  : editingId
                    ? "Guardar cambios"
                    : canPrice ? "Crear producto" : "Crear borrador"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog gestión de marcas */}
      <Dialog open={showMarcas} onOpenChange={setShowMarcas}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gestión de marcas</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nueva marca..."
                value={newMarcaNombre}
                onChange={(e) => setNewMarcaNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), crearMarca())}
              />
              <Button size="sm" onClick={crearMarca} disabled={!newMarcaNombre.trim()}>
                Crear
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {marcas.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-sm">{m.nombre}</span>
                  <Badge
                    variant="secondary"
                    className={
                      m.activo
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {m.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
              ))}
              {marcas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin marcas registradas
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog gestión de categorías */}
      <Dialog open={showCategorias} onOpenChange={setShowCategorias}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gestión de categorías</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nueva categoría..."
                value={newCategoriaNombre}
                onChange={(e) => setNewCategoriaNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), crearCategoria())}
              />
              <Button size="sm" onClick={crearCategoria} disabled={!newCategoriaNombre.trim()}>
                Crear
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {categorias.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-sm">{c.nombre}</span>
                  <Badge
                    variant="secondary"
                    className={
                      c.activo
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {c.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
              ))}
              {categorias.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin categorías registradas
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
