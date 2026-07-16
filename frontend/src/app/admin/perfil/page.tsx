"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch } from "@/lib/admin-api";
import type { Usuario } from "@/lib/types";

interface PerfilForm {
  nombre_completo: string;
  telefono: string;
  rfc: string;
  direccion_calle: string;
  direccion_ciudad: string;
  direccion_estado: string;
  direccion_cp: string;
}

const VACIO: PerfilForm = {
  nombre_completo: "",
  telefono: "",
  rfc: "",
  direccion_calle: "",
  direccion_ciudad: "",
  direccion_estado: "",
  direccion_cp: "",
};

export default function PerfilPage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState<PerfilForm>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      nombre_completo: user.nombre_completo ?? "",
      telefono: user.telefono ?? "",
      rfc: user.rfc ?? "",
      direccion_calle: user.direccion_calle ?? "",
      direccion_ciudad: user.direccion_ciudad ?? "",
      direccion_estado: user.direccion_estado ?? "",
      direccion_cp: user.direccion_cp ?? "",
    });
  }, [user]);

  function set<K extends keyof PerfilForm>(campo: K, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setGuardado(false);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      await adminFetch<Usuario>("/users/me", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      // El header y el sidebar leen del contexto: sin esto seguirían
      // mostrando el nombre viejo hasta recargar.
      await refresh();
      setGuardado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el perfil");
    } finally {
      setGuardando(false);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tus datos de contacto y facturación. Puedes actualizarlos cuando cambien.
        </p>
      </div>

      <form onSubmit={guardar} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos personales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input value={user.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                El correo no se puede cambiar desde aquí. Pídelo a un administrador.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                value={form.nombre_completo}
                onChange={(e) => set("nombre_completo", e.target.value)}
                maxLength={255}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => set("telefono", e.target.value)}
                  maxLength={32}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfc">RFC</Label>
                <Input
                  id="rfc"
                  value={form.rfc}
                  onChange={(e) => set("rfc", e.target.value.toUpperCase())}
                  placeholder="GODE561231GR8"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  13 caracteres si eres persona física, 12 si eres moral.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dirección</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calle">Calle y número</Label>
              <Input
                id="calle"
                value={form.direccion_calle}
                onChange={(e) => set("direccion_calle", e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  value={form.direccion_ciudad}
                  onChange={(e) => set("direccion_ciudad", e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={form.direccion_estado}
                  onChange={(e) => set("direccion_estado", e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp">Código postal</Label>
                <Input
                  id="cp"
                  value={form.direccion_cp}
                  onChange={(e) => set("direccion_cp", e.target.value)}
                  maxLength={10}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
          {guardado && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-600" />
              Guardado
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
