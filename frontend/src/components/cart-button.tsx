"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";

export function CartButton() {
  const { count } = useCart();
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      aria-label={`Carrito (${count})`}
      className="relative"
    >
      <Link href="/carrito">
        <ShoppingBag className="size-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
            {count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
