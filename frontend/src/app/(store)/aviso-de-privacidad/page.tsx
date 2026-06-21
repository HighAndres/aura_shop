import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function AvisoPrivacidadPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold">Aviso de privacidad</h1>
      <p className="text-sm text-muted-foreground">
        En cumplimiento de la Ley Federal de Protección de Datos Personales en
        Posesión de los Particulares (LFPDPPP).
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Aura recaba tus datos personales (nombre, correo, teléfono y datos de
        envío y facturación) con la finalidad de procesar tus pedidos, emitir
        comprobantes fiscales (CFDI) y brindarte atención. No compartimos tus
        datos con terceros salvo lo necesario para completar tu compra.
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Puedes ejercer tus derechos ARCO (acceso, rectificación, cancelación y
        oposición) escribiéndonos a{" "}
        <a href="mailto:privacidad@aura-belleza.com" className="underline">
          privacidad@aura-belleza.com
        </a>
        .
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Nos reservamos el derecho de actualizar este aviso de privacidad en
        cualquier momento. La versión vigente estará siempre disponible en esta
        página.
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Última actualización: junio 2026.
      </p>
    </article>
  );
}
