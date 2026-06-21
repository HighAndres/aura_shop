"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Search,
  Eye,
  EyeOff,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminFetch } from "@/lib/admin-api";
import type { Usuario, UsuarioPage, RolInfo } from "@/lib/types";

const PAGE_SIZE = 30;

export default function AdminUsuariosPage() {
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [roles, setRoles] = useState<RolInfo[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formNombre, setFormNombre] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formRol, setFormRol] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManage =
    currentUser?.roles.some((r) => r === "superadmin" || r === "administrador") ?? false;
  const isSuperadmin = currentUser?.roles.includes("superadmin") ?? false;

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filtro) params.set("q", filtro);
      const data = await adminFetch<UsuarioPage>(`/admin/users?${params}`);
      setUsuarios(data.items);
      setTotal(data.total);
    } catch {
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, [page, filtro]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  useEffect(() => {
    adminFetch<RolInfo[]>("/admin/users/roles")
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  function resetForm() {
    setFormEmail("");
    setFormPassword("");
    setShowPassword(false);
    setFormNombre("");
    setFormTelefono("");
    setFormRol("");
    setError("");
  }

  function openCreate() {
    resetForm();
    setEditingUser(null);
    setShowForm(true);
  }

  function openEdit(u: Usuario) {
    setEditingUser(u);
    setFormEmail(u.email);
    setFormPassword("");
    setShowPassword(false);
    setFormNombre(u.nombre_completo ?? "");
    setFormTelefono(u.telefono ?? "");
    setFormRol(u.roles[0] ?? "");
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          nombre_completo: formNombre || null,
          telefono: formTelefono || null,
          roles: formRol ? [formRol] : [],
        };
        if (formPassword) {
          body.password = formPassword;
        }
        await adminFetch(`/admin/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        if (!formEmail || !formPassword) {
          setError("Email y contraseña son obligatorios");
          setSaving(false);
          return;
        }
        if (!formRol) {
          setError("Selecciona un rol");
          setSaving(false);
          return;
        }
        await adminFetch("/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formEmail,
            password: formPassword,
            nombre_completo: formNombre || null,
            telefono: formTelefono || null,
            roles: [formRol],
          }),
        });
      }
      setShowForm(false);
      resetForm();
      fetchUsuarios();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(u: Usuario) {
    try {
      await adminFetch(`/admin/users/${u.id}/toggle`, { method: "PATCH" });
      fetchUsuarios();
    } catch {
      alert("No se pudo cambiar el estado del usuario.");
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de usuarios y roles ({total} total)
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Usuario
          </Button>
        )}
      </div>

      <div className="mt-4 mb-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email o nombre..."
            value={filtro}
            onChange={(e) => { setFiltro(e.target.value); setPage(0); }}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Verificado</TableHead>
              <TableHead>Registro</TableHead>
              {canManage && <TableHead>Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-sm font-medium">{u.email}</TableCell>
                  <TableCell className="text-sm">
                    {u.nombre_completo ?? "—"}
                  </TableCell>
                  <TableCell>
                    {u.roles.length > 0 ? (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {u.roles[0]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">sin rol</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        u.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {u.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.is_verified ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Sí
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("es-MX")}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(u)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {u.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggle(u)}
                            title={u.is_active ? "Desactivar" : "Activar"}
                          >
                            {u.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                disabled={!!editingUser}
              />
            </div>

            <div>
              <Label htmlFor="user-pass">
                {editingUser ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}
              </Label>
              <div className="relative">
                <Input
                  id="user-pass"
                  type={showPassword ? "text" : "password"}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? "••••••••" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="user-nombre">Nombre completo</Label>
              <Input
                id="user-nombre"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="user-tel">Teléfono</Label>
              <Input
                id="user-tel"
                value={formTelefono}
                onChange={(e) => setFormTelefono(e.target.value)}
              />
            </div>

            <div>
              <Label>Rol</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {roles
                  .filter((rol) => !["cliente", "invitado"].includes(rol.nombre))
                  .map((rol) => {
                    const selected = formRol === rol.nombre;
                    const disabled =
                      rol.nombre === "superadmin" && !isSuperadmin;
                    return (
                      <button
                        key={rol.nombre}
                        type="button"
                        disabled={disabled}
                        onClick={() => setFormRol(selected ? "" : rol.nombre)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {rol.nombre}
                      </button>
                    );
                  })}
              </div>
              {roles.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Cargando roles...</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editingUser ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
