const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

/** Formatea un precio (string Decimal del backend) como moneda MXN. */
export function formatMXN(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "";
  return mxn.format(n);
}
