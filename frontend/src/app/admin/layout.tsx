"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  Gift,
  Warehouse,
  ShoppingCart,
  Users,
  ScrollText,
  BarChart3,
  LogOut,
  Menu,
} from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PERM, canAny, type Permiso } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const STAFF_ROLES = ["superadmin", "administrador", "vendedor"];

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Basta con tener uno para ver la sección. Vacío = cualquier staff. */
  permisos: Permiso[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    permisos: [],
  },
  {
    // Se pide "editar" y no "leer": el vendedor necesita leer el catálogo para
    // buscar productos al levantar un pedido, pero no gestionarlo.
    href: "/admin/productos",
    label: "Productos",
    icon: Package,
    permisos: [PERM.PRODUCTOS_EDITAR],
  },
  {
    href: "/admin/paquetes",
    label: "Paquetes",
    icon: Gift,
    permisos: [PERM.PAQUETES_GESTIONAR],
  },
  {
    href: "/admin/pedidos",
    label: "Pedidos",
    icon: ShoppingCart,
    permisos: [PERM.PEDIDOS_LEER, PERM.PEDIDOS_LEER_ASIGNADOS],
  },
  {
    href: "/admin/inventario",
    label: "Inventario",
    icon: Warehouse,
    permisos: [PERM.INVENTARIO_LEER],
  },
  {
    href: "/admin/reportes",
    label: "Reportes",
    icon: BarChart3,
    permisos: [PERM.REPORTES_LEER],
  },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    icon: Users,
    permisos: [PERM.USUARIOS_LEER],
  },
  {
    href: "/admin/bitacora",
    label: "Bitácora",
    icon: ScrollText,
    permisos: [PERM.BITACORA_LEER],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

/** Sección a la que pertenece una ruta, para saber qué permiso exigirle. */
function seccionDe(pathname: string): NavItem | undefined {
  return NAV_ITEMS.filter((i) => i.href !== "/admin").find((i) =>
    pathname.startsWith(i.href),
  );
}

function SidebarContent({
  items,
  pathname,
  user,
  onLogout,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  user: { email: string; nombre_completo: string | null; roles: string[] };
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Link href="/admin" className="flex items-baseline gap-2" onClick={onNavigate}>
          <span className="font-display text-xl font-semibold tracking-tight">
            Aura
          </span>
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            admin
          </span>
        </Link>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="px-4 py-4">
        <Link
          href="/admin/perfil"
          onClick={onNavigate}
          className="mb-3 -mx-2 block rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
          title="Ver y editar mi perfil"
        >
          <p className="truncate text-sm font-medium">
            {user.nombre_completo ?? user.email}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground capitalize">
            {user.roles.join(", ")}
          </p>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/" onClick={onNavigate}>
              Ir a tienda
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout} title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isStaff =
    user && user.roles.some((r) => STAFF_ROLES.includes(r));

  const seccion = seccionDe(pathname);
  const puedeVerSeccion = !seccion || canAny(user, seccion.permisos);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }
    if (!isStaff) {
      router.replace("/");
      return;
    }
    // Ocultar el menú no basta: sin esto se entra tecleando la URL. La API
    // igual rechaza, pero el usuario vería una página rota en vez de un no.
    if (!puedeVerSeccion) {
      router.replace("/admin");
    }
  }, [user, loading, isStaff, puedeVerSeccion, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user || !isStaff || !puedeVerSeccion) return null;

  const visibleItems = NAV_ITEMS.filter((item) => canAny(user, item.permisos));

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">
        <SidebarContent
          items={visibleItems}
          pathname={pathname}
          user={user}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="flex flex-1 flex-col">
          {/* Mobile header */}
          <header className="flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <span className="font-display text-lg font-semibold">Aura</span>
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              admin
            </span>
          </header>

          <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
            {children}
          </main>

          <footer className="border-t py-3">
            <p className="text-center text-xs text-muted-foreground">
              Desarrollado por{" "}
              <a href="https://www.mirmibug.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">mirmibug</a>
            </p>
          </footer>
        </div>

        <SheetContent side="left" className="w-60 p-0">
          <SidebarContent
            items={visibleItems}
            pathname={pathname}
            user={user}
            onLogout={handleLogout}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
