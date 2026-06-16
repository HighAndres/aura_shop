"use client";

import Link from "next/link";
import { CircleUserRound } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="size-9" aria-hidden />;
  }

  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm" className="font-medium">
        <Link href="/login">Entrar</Link>
      </Button>
    );
  }

  const nombre = user.nombre_completo?.split(" ")[0] ?? user.email.split("@")[0];

  return (
    <Button asChild variant="ghost" size="sm" className="gap-1.5 font-medium">
      <Link href="/cuenta" aria-label="Mi cuenta">
        <CircleUserRound className="size-5" />
        <span className="hidden max-w-24 truncate sm:inline">{nombre}</span>
      </Link>
    </Button>
  );
}
