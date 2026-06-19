"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/auth-client";

export default function RecuperarPage() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    const fd = new FormData(e.currentTarget);
    await forgotPassword(String(fd.get("email")).trim());
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        <MailCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-xl font-semibold">Revisa tu correo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Si el correo está registrado, te enviamos instrucciones para
          restablecer tu contraseña.
        </p>
        <Button asChild variant="ghost" className="mt-6">
          <Link href="/login">Volver a iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Te enviaremos un enlace para crear una nueva.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block space-y-1 text-sm">
          <span>Correo</span>
          <Input name="email" type="email" required autoComplete="email" />
        </label>
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : "Enviar enlace"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="hover:text-foreground">
          Volver
        </Link>
      </p>
    </div>
  );
}
