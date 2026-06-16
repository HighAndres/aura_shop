"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMXN } from "@/lib/format";

export default function CarritoPage() {
  const { cart, loading, setQty, remove } = useCart();

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Tu carrito</h1>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Tu carrito está vacío</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explora el catálogo y agrega tus productos favoritos.
        </p>
        <Button asChild className="mt-6">
          <Link href="/productos">Ver productos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tu carrito</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Items */}
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <li
              key={item.variante_id}
              className="flex gap-4 rounded-xl border p-3"
            >
              <Link
                href={`/productos/${item.producto_slug}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted"
              >
                {item.imagen ? (
                  <Image
                    src={item.imagen}
                    alt={item.nombre}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/productos/${item.producto_slug}`}
                  className="line-clamp-2 text-sm font-medium hover:underline"
                >
                  {item.nombre}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {formatMXN(item.precio_unitario)}
                </p>

                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center rounded-lg border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Disminuir"
                      disabled={item.cantidad <= 1}
                      onClick={() => setQty(item.sku, item.cantidad - 1)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center text-sm tabular-nums">
                      {item.cantidad}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Aumentar"
                      disabled={item.cantidad >= item.disponible}
                      onClick={() => setQty(item.sku, item.cantidad + 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>

                  <span className="text-sm font-semibold">
                    {formatMXN(item.subtotal)}
                  </span>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label="Quitar"
                    onClick={() => remove(item.sku)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Resumen */}
        <aside className="h-fit space-y-4 rounded-xl border p-5 lg:sticky lg:top-20">
          <h2 className="text-lg font-semibold">Resumen</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Subtotal ({cart.total_items} art.)
            </span>
            <span className="font-medium">{formatMXN(cart.subtotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            El envío se calcula en el siguiente paso.
          </p>
          <Button asChild className="w-full rounded-full" size="lg">
            <Link href="/checkout">Proceder al pago</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/productos">Seguir comprando</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
