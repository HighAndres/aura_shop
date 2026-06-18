import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-secondary/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div className="space-y-2">
          <p className="font-display text-xl font-semibold">Aura Shop</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Belleza y cuidado personal. Productos seleccionados con envío en
            México.
          </p>
        </div>

        <nav className="space-y-2 text-sm" aria-label="Tienda">
          <p className="font-medium">Tienda</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>
              <Link href="/productos" className="hover:text-foreground">
                Todos los productos
              </Link>
            </li>
            <li>
              <Link
                href="/productos?categoria=labiales"
                className="hover:text-foreground"
              >
                Labiales
              </Link>
            </li>
            <li>
              <Link
                href="/productos?categoria=cuidado-facial"
                className="hover:text-foreground"
              >
                Cuidado facial
              </Link>
            </li>
          </ul>
        </nav>

        <nav className="space-y-2 text-sm" aria-label="Legal">
          <p className="font-medium">Legal</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>
              <Link href="/aviso-de-privacidad" className="hover:text-foreground">
                Aviso de privacidad
              </Link>
            </li>
            <li>
              <Link href="/terminos" className="hover:text-foreground">
                Términos y condiciones
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t py-4">
        <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} Aura Shop · Hecho con cariño en México</span>
          <span>Desarrollado por mirmibug</span>
        </p>
      </div>
    </footer>
  );
}
