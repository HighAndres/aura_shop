import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TerminosPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold">Términos y condiciones</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Al comprar en Aura aceptas estos términos. Los precios están en pesos
        mexicanos (MXN) e incluyen impuestos cuando aplica. La disponibilidad de
        productos puede variar sin previo aviso.
      </p>
      <h2 className="text-xl font-semibold pt-2">Pedidos y envíos</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Una vez confirmado tu pedido recibirás un correo de confirmación con tu
        número de orden. Los tiempos de envío son estimados y pueden variar según
        tu ubicación. Aura no se hace responsable por retrasos causados por
        terceros (paqueterías).
      </p>
      <h2 className="text-xl font-semibold pt-2">Devoluciones</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Por la naturaleza de los productos de belleza, solo aceptamos
        devoluciones de artículos sin abrir y en su empaque original dentro de
        los 15 días naturales posteriores a la entrega. Para iniciar una
        devolución, contáctanos a{" "}
        <a href="mailto:soporte@aura-belleza.com" className="underline">
          soporte@aura-belleza.com
        </a>
        .
      </p>
      <h2 className="text-xl font-semibold pt-2">Propiedad intelectual</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Todo el contenido de este sitio (textos, imágenes, logotipos y diseño)
        es propiedad de Aura y está protegido por las leyes de propiedad
        intelectual aplicables.
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground pt-2">
        Última actualización: junio 2026.
      </p>
    </article>
  );
}
