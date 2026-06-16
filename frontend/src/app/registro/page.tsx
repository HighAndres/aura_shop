"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegistroPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setEnviando(true);
    try {
      await register(
        String(fd.get("email")).trim(),
        password,
        String(fd.get("nombre_completo")).trim() || undefined,
      );
      router.push("/cuenta");
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("registrado")
          ? "Ese correo ya está registrado."
          : "No se pudo crear la cuenta.",
      );
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-2xl font-bold">Crear cuenta</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Regístrate para guardar tus datos y seguir tus pedidos.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block space-y-1 text-sm">
          <span>Nombre completo</span>
          <Input name="nombre_completo" autoComplete="name" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Correo</span>
          <Input name="email" type="email" required autoComplete="email" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Contraseña</span>
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <span className="text-xs text-muted-foreground">Mínimo 8 caracteres.</span>
        </label>

        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
