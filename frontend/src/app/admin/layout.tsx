"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { esAdministrador, esStaff, esSuperadmin } from "@/lib/roles";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !esStaff(user)) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !esStaff(user)) {
    return <Skeleton className="h-64 w-full" />;
  }

  const nav = [
    { href: "/admin/pedidos", label: "Pedidos" },
    ...(esAdministrador(user)
      ? [
          { href: "/admin/productos", label: "Productos" },
          { href: "/admin/reportes", label: "Reportes" },
        ]
      : []),
    ...(esSuperadmin(user)
      ? [{ href: "/admin/bitacora", label: "Bitácora" }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Administración</h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {user?.roles[0]}
        </span>
      </div>
      <nav className="flex gap-1 border-b">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(n.href)
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
