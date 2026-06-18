"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import * as admin from "@/lib/admin-client";
import type { ProductoAdminDetalle, VarianteAdmin } from "@/lib/types";

function VarianteRow({ v }: { v: VarianteAdmin }) {
  const [precio, setPrecio] = useState(v.precio);
  const [estado, setEstado] = useState<"idle" | "saving" | "ok">("idle");

  async function guardar() {
    setEstado("saving");
    try {
      const upd = await admin.updateVariante(v.id, { precio });
      setPrecio(upd.precio);
      setEstado("ok");
      setTimeout(() => setEstado("idle"), 1200);
    } catch {
      setEstado("idle");
    }
  }

  return (
    <tr className="border-b last:border-0">
      <td className="p-3 font-medium">{v.sku}</td>
      <td className="p-3 text-muted-foreground">{v.nombre ?? "—"}</td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">$</span>
          <Input
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="h-8 w-24"
            inputMode="decimal"
          />
          <Button size="sm" variant="outline" onClick={guardar} disabled={estado === "saving"}>
            {estado === "saving" ? (
              <Loader2 className="animate-spin" />
            ) : estado === "ok" ? (
              "Guardado"
            ) : (
              "Guardar"
            )}
          </Button>
        </div>
      </td>
      <td className="p-3">{v.activo ? "Activa" : "Inactiva"}</td>
    </tr>
  );
}

export default function AdminProductoDetalle() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [producto, setProducto] = useState<ProductoAdminDetalle | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [agregando, setAgregando] = useState(false);

  async function cargar() {
    try {
      setProducto(await admin.getProducto(id));
    } catch {
      setNoEncontrado(true);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function guardarProducto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    const fd = new FormData(e.currentTarget);
    try {
      await admin.updateProducto(id, {
        nombre: String(fd.get("nombre")).trim(),
        descripcion_corta: String(fd.get("descripcion_corta")).trim() || null,
        destacado: fd.get("destacado") === "on",
        activo: fd.get("activo") === "on",
      });
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function agregarVariante(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAgregando(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await admin.createVariante(id, {
        sku: String(fd.get("sku")).trim(),
        nombre: String(fd.get("nombre")).trim() || null,
        precio: String(fd.get("precio")).trim(),
      });
      await cargar();
      form.reset();
    } finally {
      setAgregando(false);
    }
  }

  if (noEncontrado) {
    return <p className="text-sm text-muted-foreground">Producto no encontrado.</p>;
  }
  if (!producto) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/productos"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Volver a productos
      </Link>

      {/* Datos del producto */}
      <form onSubmit={guardarProducto} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Datos del producto</h2>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Nombre</span>
          <Input name="nombre" defaultValue={producto.nombre} required />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Descripción corta</span>
          <Input name="descripcion_corta" defaultValue={producto.descripcion_corta ?? ""} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="destacado" defaultChecked={producto.destacado} className="size-4 accent-primary" />
          Destacado
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={producto.activo} className="size-4 accent-primary" />
          Activo (visible en la tienda)
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={guardando}>
            {guardando ? <Loader2 className="animate-spin" /> : "Guardar cambios"}
          </Button>
        </div>
      </form>

      {/* Variantes */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Variantes ({producto.variantes.length})</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">SKU</th>
                <th className="p-3 font-medium">Nombre</th>
                <th className="p-3 font-medium">Precio</th>
                <th className="p-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {producto.variantes.map((v) => (
                <VarianteRow key={v.id} v={v} />
              ))}
              {producto.variantes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    Sin variantes aún.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Agregar variante */}
        <form onSubmit={agregarVariante} className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
          <label className="space-y-1 text-sm">
            <span>SKU *</span>
            <Input name="sku" required className="w-40" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Nombre</span>
            <Input name="nombre" className="w-40" placeholder="p. ej. 100 ml" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Precio *</span>
            <Input name="precio" required className="w-28" inputMode="decimal" />
          </label>
          <Button type="submit" disabled={agregando}>
            {agregando ? <Loader2 className="animate-spin" /> : <><Plus /> Agregar variante</>}
          </Button>
        </form>
      </div>
    </div>
  );
}
