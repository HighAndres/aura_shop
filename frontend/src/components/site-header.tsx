import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-lg">Aura</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            belleza &amp; cuidado
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/productos">Productos</Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Carrito">
            <Link href="/carrito">
              <ShoppingBag className="size-5" />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
