import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Carrito" };

export default function CarritoPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold">Tu carrito</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        El carrito y el checkout (incluido el de invitado) llegan en la próxima
        etapa del desarrollo.
      </p>
      <Button asChild className="mt-6">
        <Link href="/productos">Seguir comprando</Link>
      </Button>
    </div>
  );
}
