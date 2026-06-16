"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";

export function AddToCart({ sku }: { sku: string }) {
  const { add } = useCart();
  const [estado, setEstado] = useState<"idle" | "cargando" | "ok">("idle");

  async function handleClick() {
    setEstado("cargando");
    try {
      await add(sku, 1);
      setEstado("ok");
      setTimeout(() => setEstado("idle"), 1500);
    } catch {
      setEstado("idle");
    }
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={estado === "cargando"}>
      {estado === "cargando" ? (
        <Loader2 className="animate-spin" />
      ) : estado === "ok" ? (
        <>
          <Check /> Agregado
        </>
      ) : (
        "Agregar"
      )}
    </Button>
  );
}
