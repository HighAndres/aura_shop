import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CartButton } from "@/components/cart-button";
import { UserMenu } from "@/components/user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-baseline gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-display text-2xl font-semibold tracking-tight">
            Aura
          </span>
          <span className="hidden text-xs font-medium uppercase tracking-widest text-muted-foreground sm:inline">
            belleza
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="font-medium">
            <Link href="/productos">Productos</Link>
          </Button>
          <UserMenu />
          <CartButton />
        </nav>
      </div>
    </header>
  );
}
