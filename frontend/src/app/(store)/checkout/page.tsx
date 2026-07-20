"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { checkout, clearStoredCart } from "@/lib/cart-client";
import { formatMXN } from "@/lib/format";
import type { CheckoutPayload, Pedido } from "@/lib/types";

function val(fd: FormData, key: string): string | undefined {
  const v = (fd.get(key) as string | null)?.trim();
  return v ? v : undefined;
}

export default function CheckoutPage() {
  const { cart, clear } = useCart();
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);

  // Confirmación tras comprar
  if (pedido) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">¡Gracias por tu compra!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu pedido <span className="font-semibold text-foreground">{pedido.numero}</span>{" "}
          quedó registrado por {formatMXN(pedido.total)}. Te enviamos la
          confirmación a {pedido.email}.
        </p>
        <Button asChild className="mt-6">
          <Link href="/productos">Seguir comprando</Link>
        </Button>
      </div>
    );
  }

  if (!cart || (cart.items.length === 0 && cart.paquetes.length === 0)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold">No hay nada que pagar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu carrito está vacío.
        </p>
        <Button asChild className="mt-6">
          <Link href="/productos">Ver productos</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const fd = new FormData(e.currentTarget);
    const payload: CheckoutPayload = {
      email: val(fd, "email"),
      nombre_contacto: val(fd, "nombre_contacto") ?? "",
      telefono: val(fd, "telefono"),
      direccion_calle: val(fd, "direccion_calle"),
      direccion_ciudad: val(fd, "direccion_ciudad"),
      direccion_estado: val(fd, "direccion_estado"),
      direccion_cp: val(fd, "direccion_cp"),
      notas: val(fd, "notas"),
      requiere_factura: requiereFactura,
      rfc: requiereFactura ? val(fd, "rfc") : undefined,
      razon_social: requiereFactura ? val(fd, "razon_social") : undefined,
      regimen_fiscal: requiereFactura ? val(fd, "regimen_fiscal") : undefined,
      uso_cfdi: requiereFactura ? val(fd, "uso_cfdi") : undefined,
      cp_fiscal: requiereFactura ? val(fd, "cp_fiscal") : undefined,
    };
    try {
      const result = await checkout(payload);
      clearStoredCart();
      clear();
      setPedido(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el pedido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Finalizar compra</h1>

      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Contacto */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Contacto</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Nombre completo *</span>
                <Input name="nombre_contacto" required autoComplete="name" />
              </label>
              <label className="space-y-1 text-sm">
                <span>Correo *</span>
                <Input name="email" type="email" required autoComplete="email" />
              </label>
              <label className="space-y-1 text-sm">
                <span>Teléfono</span>
                <Input name="telefono" type="tel" autoComplete="tel" />
              </label>
            </div>
          </fieldset>

          {/* Envío */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Dirección de envío</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>Calle y número</span>
                <Input name="direccion_calle" autoComplete="street-address" required />
              </label>
              <label className="space-y-1 text-sm">
                <span>Ciudad</span>
                <Input name="direccion_ciudad" required />
              </label>
              <label className="space-y-1 text-sm">
                <span>Estado</span>
                <Input name="direccion_estado" required />
              </label>
              <label className="space-y-1 text-sm">
                <span>Código postal</span>
                <Input name="direccion_cp" inputMode="numeric" required />
              </label>
            </div>
            <label className="space-y-1 text-sm">
              <span>Notas (opcional)</span>
              <Textarea name="notas" placeholder="Indicaciones de entrega…" />
            </label>
          </fieldset>

          {/* Facturación CFDI */}
          <fieldset className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={requiereFactura}
                onChange={(e) => setRequiereFactura(e.target.checked)}
              />
              Requiero factura (CFDI)
            </label>
            {requiereFactura ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span>RFC *</span>
                  <Input name="rfc" required={requiereFactura} maxLength={13} />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Razón social</span>
                  <Input name="razon_social" />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Régimen fiscal *</span>
                  <Input name="regimen_fiscal" placeholder="p. ej. 616" required={requiereFactura} />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Uso de CFDI *</span>
                  <Input name="uso_cfdi" placeholder="p. ej. S01" required={requiereFactura} />
                </label>
                <label className="space-y-1 text-sm">
                  <span>CP fiscal</span>
                  <Input name="cp_fiscal" inputMode="numeric" />
                </label>
              </div>
            ) : null}
          </fieldset>

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        {/* Resumen */}
        <aside className="h-fit space-y-4 rounded-xl border p-5 lg:sticky lg:top-20">
          <h2 className="text-lg font-semibold">Tu pedido</h2>
          <ul className="space-y-2 text-sm">
            {cart.items.map((it) => (
              <li key={it.variante_id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-muted-foreground">
                  {it.cantidad}× {it.nombre}
                </span>
                <span className="shrink-0">{formatMXN(it.subtotal)}</span>
              </li>
            ))}
            {cart.paquetes.map((p) => (
              <li key={p.paquete_id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-muted-foreground">
                  {p.cantidad}× Paquete: {p.nombre}
                </span>
                <span className="shrink-0">{formatMXN(p.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t pt-3 font-semibold">
            <span>Total</span>
            <span>{formatMXN(cart.subtotal)}</span>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full"
            disabled={enviando}
          >
            {enviando ? <Loader2 className="animate-spin" /> : "Confirmar pedido"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Al confirmar aceptas nuestros{" "}
            <a href="/terminos" className="underline">términos y condiciones</a>.
          </p>
        </aside>
      </form>
    </div>
  );
}
