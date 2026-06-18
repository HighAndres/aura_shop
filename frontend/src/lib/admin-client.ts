// Cliente de administración (navegador). Usa el JWT de localStorage.

import type {
  AuditoriaPage,
  Categoria,
  Marca,
  PedidosAdminPage,
  ProductoAdmin,
  ProductoAdminDetalle,
  StockBajoItem,
  TopProducto,
  VarianteAdmin,
  VentasResumen,
} from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const access =
    typeof window !== "undefined"
      ? window.localStorage.getItem("aura_access_token")
      : null;
  if (access) h["Authorization"] = `Bearer ${access}`;
  return h;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const b = await res.json();
      if (typeof b?.detail === "string") detail = b.detail;
    } catch {
      /* sin cuerpo */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- Productos ---
export function listProductos(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return req<ProductoAdmin[]>(`/admin/catalog/productos${qs}`);
}

export function getProducto(id: string) {
  return req<ProductoAdminDetalle>(`/admin/catalog/productos/${id}`);
}

export function createProducto(data: Record<string, unknown>) {
  return req<ProductoAdmin>("/admin/catalog/productos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProducto(id: string, data: Record<string, unknown>) {
  return req<ProductoAdmin>(`/admin/catalog/productos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- Variantes ---
export function createVariante(productoId: string, data: Record<string, unknown>) {
  return req<VarianteAdmin>(`/admin/catalog/productos/${productoId}/variantes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateVariante(id: string, data: Record<string, unknown>) {
  return req<VarianteAdmin>(`/admin/catalog/variantes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- Marcas / Categorías ---
export function createMarca(nombre: string) {
  return req<Marca>("/admin/catalog/marcas", {
    method: "POST",
    body: JSON.stringify({ nombre }),
  });
}

export function createCategoria(nombre: string) {
  return req<Categoria>("/admin/catalog/categorias", {
    method: "POST",
    body: JSON.stringify({ nombre }),
  });
}

export function listMarcas() {
  return req<Marca[]>("/catalog/marcas");
}

export function listCategorias() {
  return req<Categoria[]>("/catalog/categorias");
}

// --- Pedidos ---
export function fetchPedidos(params: { estado?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.estado) qs.set("estado", params.estado);
  if (params.q) qs.set("q", params.q);
  qs.set("limit", "100");
  return req<PedidosAdminPage>(`/orders/admin?${qs.toString()}`);
}

export function cambiarEstadoPedido(numero: string, estado: string) {
  return req(`/orders/admin/${numero}/estado`, {
    method: "POST",
    body: JSON.stringify({ estado }),
  });
}

export function cancelarPedido(numero: string) {
  return req(`/orders/admin/${numero}/cancelar`, { method: "POST" });
}

// --- Reportes ---
export function fetchVentas() {
  return req<VentasResumen>("/reports/ventas");
}

export function fetchTopProductos(limit = 10) {
  return req<TopProducto[]>(`/reports/top-productos?limit=${limit}`);
}

export function fetchStockBajo(umbral = 5) {
  return req<StockBajoItem[]>(`/reports/stock-bajo?umbral=${umbral}`);
}

// --- Bitácora ---
export function fetchBitacora(params: {
  actor?: string;
  accion?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (params.actor) qs.set("actor", params.actor);
  if (params.accion) qs.set("accion", params.accion);
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  return req<AuditoriaPage>(`/audit?${qs.toString()}`);
}
