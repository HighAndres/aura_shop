import { ProductCard } from "@/components/product-card";
import { getProductos } from "@/lib/catalog";
import type { ProductoListItem } from "@/lib/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Productos" };

interface PageProps {
  searchParams: {
    categoria?: string;
    marca?: string;
    q?: string;
  };
}

export default async function ProductosPage({ searchParams }: PageProps) {
  let items: ProductoListItem[] = [];
  let total = 0;
  let errorApi = false;

  try {
    const page = await getProductos({
      categoria: searchParams.categoria,
      marca: searchParams.marca,
      q: searchParams.q,
      limit: 24,
    });
    items = page.items;
    total = page.total;
  } catch {
    errorApi = true;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
        {!errorApi && (
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "producto" : "productos"}
            {searchParams.categoria ? ` en “${searchParams.categoria}”` : ""}
          </p>
        )}
      </header>

      {errorApi ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No pudimos cargar el catálogo. ¿Está corriendo el backend en{" "}
          <code className="text-foreground">:8000</code>?
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No hay productos para esta búsqueda.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} producto={p} />
          ))}
        </div>
      )}
    </div>
  );
}
