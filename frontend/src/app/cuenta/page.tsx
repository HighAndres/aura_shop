"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Package, LogOut, BadgeCheck, ShieldAlert } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function CuentaPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <Skeleton className="mx-auto h-48 max-w-md" />;
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </div>

      <div className="space-y-3 rounded-xl border p-5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Nombre</span>
          <span>{user.nombre_completo ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Correo verificado</span>
          {user.is_verified ? (
            <span className="flex items-center gap-1 text-primary">
              <BadgeCheck className="size-4" /> Sí
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <ShieldAlert className="size-4" /> Pendiente
            </span>
          )}
        </div>
      </div>

      <Button asChild variant="outline" className="w-full justify-start gap-2">
        <Link href="/cuenta/pedidos">
          <Package className="size-4" /> Mis pedidos
        </Link>
      </Button>

      <Button
        variant="ghost"
        className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
        onClick={() => {
          logout();
          router.push("/");
        }}
      >
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </div>
  );
}
