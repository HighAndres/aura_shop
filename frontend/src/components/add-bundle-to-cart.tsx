"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";

export function AddBundleToCart({ slug }: { slug: string }) {
  const { addPaquete } = useCart();
  const [estado, setEstado] = useState<"idle" | "cargando" | "ok" | "error">("idle");

  async function handleClick() {
    setEstado("cargando");
    try {
      await addPaquete(slug, 1);
      setEstado("ok");
      setTimeout(() => setEstado("idle"), 1500);
    } catch {
      setEstado("error");
      setTimeout(() => setEstado("idle"), 2000);
    }
  }

  return (
    <Button
      size="sm"
      onClick={handleClick}
      disabled={estado === "cargando"}
      variant={estado === "error" ? "destructive" : "default"}
    >
      {estado === "cargando" ? (
        <Loader2 className="animate-spin" />
      ) : estado === "ok" ? (
        <>
          <Check /> Agregado
        </>
      ) : estado === "error" ? (
        "No disponible"
      ) : (
        "Agregar"
      )}
    </Button>
  );
}
