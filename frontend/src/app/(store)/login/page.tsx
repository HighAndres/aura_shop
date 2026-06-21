"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const fd = new FormData(e.currentTarget);
    try {
      await login(
        String(fd.get("email")).trim(),
        String(fd.get("password")),
      );
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : "/cuenta");
    } catch {
      setError("Correo o contraseña incorrectos.");
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Entra para ver tus pedidos y comprar más rápido.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
            autoComplete="current-password"
          />
        </label>

        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : "Entrar"}
        </Button>
      </form>

      <div className="mt-4 space-y-1 text-center text-sm text-muted-foreground">
        <p>
          <Link href="/recuperar" className="hover:text-foreground">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <p>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-primary hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
