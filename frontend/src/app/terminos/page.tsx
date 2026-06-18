import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TerminosPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold">Términos y condiciones</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Al comprar en Aura Shop aceptas estos términos. Los precios están en pesos
        mexicanos (MXN) e incluyen impuestos cuando aplica. La disponibilidad de
        productos puede variar. Este texto es un borrador y será reemplazado por
        los términos definitivos.
      </p>
    </article>
  );
}
