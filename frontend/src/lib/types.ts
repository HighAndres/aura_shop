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

// --- Usuario / auth ---

export interface Usuario {
  id: string;
  email: string;
  nombre_completo: string | null;
  telefono: string | null;
  is_active: boolean;
  is_verified: boolean;
  roles: string[];
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
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
  telefono: string | null;
  direccion_calle: string | null;
  direccion_ciudad: string | null;
  direccion_estado: string | null;
  direccion_cp: string | null;
  subtotal: string;
  envio: string;
  total: string;
  requiere_factura: boolean;
  rfc: string | null;
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

// --- Admin ---

export interface PedidoPage {
  items: Pedido[];
  total: number;
  limit: number;
  offset: number;
}

export interface StockItem {
  sku: string;
  producto: string;
  almacen: string | null;
  disponible: number;
}

export interface Almacen {
  id: string;
  nombre: string;
  codigo: string;
  activo: boolean;
}

export interface Movimiento {
  id: string;
  sku: string;
  almacen: string;
  tipo: string;
  cantidad: number;
  lote: string | null;
  referencia: string | null;
  nota: string | null;
  fecha: string;
}

// --- Admin Catálogo ---

export interface VarianteAdmin {
  id: string;
  sku: string;
  nombre: string | null;
  precio: string;
  precio_comparativo: string | null;
  activo: boolean;
}

export interface ImagenAdmin {
  id: string;
  url: string;
  alt: string | null;
  orden: number;
  es_principal: boolean;
}

export interface ProductoAdmin {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  descripcion_corta: string | null;
  marca_id: string | null;
  categoria_id: string | null;
  activo: boolean;
  destacado: boolean;
  variantes: VarianteAdmin[];
  imagenes: ImagenAdmin[];
  created_at: string | null;
}

export interface ProductoAdminPage {
  items: ProductoAdmin[];
  total: number;
  limit: number;
  offset: number;
}

export interface MarcaAdmin {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  logo_url: string | null;
  activo: boolean;
}

export interface CategoriaAdmin {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  parent_id: string | null;
  orden: number;
  activo: boolean;
}

export interface AuditoriaEntry {
  id: string;
  usuario_id: string | null;
  actor_email: string | null;
  actor_rol: string | null;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  descripcion: string;
  cambios: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface AuditoriaPage {
  items: AuditoriaEntry[];
  total: number;
  limit: number;
  offset: number;
}

// --- Admin Usuarios ---

export interface UsuarioPage {
  items: Usuario[];
  total: number;
  limit: number;
  offset: number;
}

export interface RolInfo {
  nombre: string;
  descripcion: string | null;
}

// --- Admin Reportes ---

export interface VentasDiarias {
  fecha: string;
  pedidos: number;
  total: string;
}

export interface VentasResumen {
  periodo_inicio: string;
  periodo_fin: string;
  total_pedidos: number;
  total_ventas: string;
  ticket_promedio: string;
  por_estado: Record<string, number>;
  productos_top: { nombre: string; cantidad: number; ingresos: string }[];
  ventas_diarias: VentasDiarias[];
}

export interface InventarioResumen {
  total_skus: number;
  skus_con_stock: number;
  skus_sin_stock: number;
  valor_inventario: string;
  movimientos_recientes: number;
  stock_bajo: { sku: string; disponible: number }[];
}
