// Tipos que reflejan los schemas del backend (app/schemas/catalog.py).

export interface Marca {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
}

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  parent_id: string | null;
}

export interface ValorAtributo {
  atributo: string;
  valor: string;
}

export interface Imagen {
  url: string;
  alt: string | null;
  es_principal: boolean;
}

export interface Variante {
  id: string;
  sku: string;
  nombre: string | null;
  precio: string; // Decimal serializado como string
  precio_comparativo: string | null;
  activo: boolean;
  disponible: number;
  atributos: ValorAtributo[];
}

export interface ProductoListItem {
  id: string;
  nombre: string;
  slug: string;
  descripcion_corta: string | null;
  marca: string | null;
  destacado: boolean;
  precio_desde: string | null;
  imagen: string | null;
}

export interface ProductoDetalle {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  descripcion_corta: string | null;
  destacado: boolean;
  marca: Marca | null;
  categoria: Categoria | null;
  imagenes: Imagen[];
  variantes: Variante[];
  rating_promedio: number | null;
  num_resenas: number;
}

export interface ProductosPage {
  items: ProductoListItem[];
  total: number;
  limit: number;
  offset: number;
}

// --- Carrito ---

export interface CartItem {
  variante_id: string;
  sku: string;
  nombre: string;
  producto_slug: string;
  imagen: string | null;
  precio_unitario: string;
  cantidad: number;
  subtotal: string;
  disponible: number;
}

export interface Cart {
  id: string | null;
  token: string | null;
  items: CartItem[];
  total_items: number;
  subtotal: string;
}

// --- Pedido ---

export interface PedidoItem {
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: string;
  subtotal: string;
}

export interface Pedido {
  id: string;
  numero: string;
  email: string;
  estado: string;
  nombre_contacto: string;
  subtotal: string;
  envio: string;
  total: string;
  requiere_factura: boolean;
  items: PedidoItem[];
  created_at: string;
}

export interface CheckoutPayload {
  email?: string;
  nombre_contacto: string;
  telefono?: string;
  direccion_calle?: string;
  direccion_ciudad?: string;
  direccion_estado?: string;
  direccion_cp?: string;
  notas?: string;
  requiere_factura: boolean;
  rfc?: string;
  razon_social?: string;
  regimen_fiscal?: string;
  uso_cfdi?: string;
  cp_fiscal?: string;
}
