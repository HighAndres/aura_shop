import type { Usuario } from "@/lib/types";

const STAFF = new Set(["superadmin", "administrador", "vendedor"]);

/** ¿El usuario es personal (puede ver el panel de administración)? */
export function esStaff(user: Usuario | null): boolean {
  return !!user && user.roles.some((r) => STAFF.has(r));
}

export function esAdministrador(user: Usuario | null): boolean {
  return !!user && user.roles.some((r) => r === "superadmin" || r === "administrador");
}

export function esSuperadmin(user: Usuario | null): boolean {
  return !!user && user.roles.includes("superadmin");
}
