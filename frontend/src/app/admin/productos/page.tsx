"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import * as admin from "@/lib/admin-client";
import { formatMXN } from "@/lib/format";
import type { Categoria, Marca, ProductoAdmin } from "@/lib/types";

const selectCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function AdminProductosPage() {
  const [productos, setProductos] = useState<ProductoAdmin[] | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  async function cargar() {
    const [p, m, c] = await Promise.all([
      admin.listProductos(),
      admin.listMarcas(),
      admin.listCategorias(),
    ]);
    setProductos(p);
    setMarcas(m);
    setCategorias(c);
  }

  useEffect(() => {
    cargar().catch(() => setProductos([]));
  }, []);

  async function onCrear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreando(true);
    const fd = new FormData(e.currentTarget);
    try {
      const nuevo = await admin.createProducto({
        nombre: String(fd.get("nombre")).trim(),
        descripcion_corta: String(fd.get("descripcion_corta")).trim() || undefined,
        marca_id: String(fd.get("marca_id")) || undefined,
        categoria_id: String(fd.get("categoria_id")) || undefined,
        destacado: fd.get("destacado") === "on",
      });
      setProductos((prev) => [nuevo, ...(prev ?? [])]);
      setMostrarForm(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {productos?.length ?? 0} productos
        </p>
        <Button size="sm" onClick={() => setMostrarForm((v) => !v)}>
          <Plus /> Nuevo producto
        </Button>
      </div>

      {mostrarForm ? (
        <form
          onSubmit={onCrear}
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
        >
          <label className="space-y-1 text-sm sm:col-span-2">
            <span>Nombre *</span>
            <Input name="nombre" required />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span>Descripción corta</span>
            <Input name="descripcion_corta" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Marca</span>
            <select name="marca_id" className={selectCls} defaultValue="">
              <option value="">— Sin marca —</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Categoría</span>
            <select name="categoria_id" className={selectCls} defaultValue="">
              <option value="">— Sin categoría —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="destacado" className="size-4 accent-primary" />
            Destacado
          </label>
          {error ? (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creando}>
              {creando ? <Loader2 className="animate-spin" /> : "Crear producto"}
            </Button>
          </div>
        </form>
      ) : null}

      {productos === null ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Producto</th>
                <th className="p-3 font-medium">Marca</th>
                <th className="p-3 font-medium">Variantes</th>
                <th className="p-3 font-medium">Desde</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{p.nombre}</td>
                  <td className="p-3 text-muted-foreground">{p.marca ?? "—"}</td>
                  <td className="p-3">{p.num_variantes}</td>
                  <td className="p-3">
                    {p.precio_min ? formatMXN(p.precio_min) : "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        p.activo
                          ? "text-primary"
                          : "text-muted-foreground"
                      }
                    >
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/admin/productos/${p.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      Gestionar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
