/**
 * Permisos del sistema, espejo del catálogo del backend
 * (backend/scripts/seed_rbac.py).
 *
 * La autorización real vive en el backend: esto solo decide qué se muestra.
 * Nunca es la única barrera — cada endpoint valida por su cuenta.
 */

import type { Usuario } from "@/lib/types";

export const PERM = {
  PERFIL_EDITAR_PROPIO: "perfil.editar_propio",

  PRODUCTOS_LEER: "productos.leer",
  PRODUCTOS_VER_PRECIO: "productos.ver_precio",
  PRODUCTOS_CREAR: "productos.crear",
  PRODUCTOS_EDITAR: "productos.editar",
  PRODUCTOS_ELIMINAR: "productos.eliminar",

  MARCAS_GESTIONAR: "marcas.gestionar",
  CATEGORIAS_GESTIONAR: "categorias.gestionar",
  PAQUETES_GESTIONAR: "paquetes.gestionar",

  INVENTARIO_LEER: "inventario.leer",
  INVENTARIO_AJUSTAR: "inventario.ajustar",

  PEDIDOS_LEER: "pedidos.leer",
  PEDIDOS_LEER_ASIGNADOS: "pedidos.leer_asignados",
  PEDIDOS_CREAR: "pedidos.crear",
  PEDIDOS_MARCAR_PAGADO: "pedidos.marcar_pagado",
  PEDIDOS_MARCAR_ENVIADO: "pedidos.marcar_enviado",
  PEDIDOS_MARCAR_ENTREGADO: "pedidos.marcar_entregado",
  PEDIDOS_CANCELAR: "pedidos.cancelar",
  PEDIDOS_REASIGNAR: "pedidos.reasignar",

  USUARIOS_LEER: "usuarios.leer",
  ROLES_GESTIONAR: "roles.gestionar",
  REPORTES_LEER: "reportes.leer",
  BITACORA_LEER: "bitacora.leer",
} as const;

export type Permiso = (typeof PERM)[keyof typeof PERM];

type ConPermisos = Pick<Usuario, "permisos"> | null | undefined;

/** ¿El usuario tiene este permiso? */
export function can(user: ConPermisos, permiso: Permiso): boolean {
  return user?.permisos?.includes(permiso) ?? false;
}

/** ¿Tiene al menos uno? Lista vacía = sí (sin restricción). */
export function canAny(user: ConPermisos, permisos: readonly Permiso[]): boolean {
  if (permisos.length === 0) return true;
  return permisos.some((p) => can(user, p));
}
