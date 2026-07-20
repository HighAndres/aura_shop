// Funciones de acceso al catálogo (envuelven los endpoints públicos del backend).

import { apiFetch, ApiError } from "@/lib/api";
import type {
  Categoria,
  Marca,
  PaquetesPage,
  ProductoDetalle,
  ProductosPage,
} from "@/lib/types";

export function getMarcas() {
  return apiFetch<Marca[]>("/catalog/marcas");
}

export function getCategorias() {
  return apiFetch<Categoria[]>("/catalog/categorias");
}

export interface ListarProductosParams {
  categoria?: string;
  marca?: string;
  q?: string;
  destacado?: boolean;
  limit?: number;
  offset?: number;
}

export function getProductos(params: ListarProductosParams = {}) {
  const qs = new URLSearchParams();
  if (params.categoria) qs.set("categoria", params.categoria);
  if (params.marca) qs.set("marca", params.marca);
  if (params.q) qs.set("q", params.q);
  if (params.destacado !== undefined) qs.set("destacado", String(params.destacado));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return apiFetch<ProductosPage>(`/catalog/productos${query ? `?${query}` : ""}`);
}

export function getPaquetes(params: { limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return apiFetch<PaquetesPage>(`/catalog/paquetes${query ? `?${query}` : ""}`);
}

/** Devuelve el detalle del producto o null si no existe (404). */
export async function getProducto(slug: string): Promise<ProductoDetalle | null> {
  try {
    return await apiFetch<ProductoDetalle>(
      `/catalog/productos/${encodeURIComponent(slug)}`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
