"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import * as admin from "@/lib/admin-client";
import type { Auditoria } from "@/lib/types";

export default function BitacoraPage() {
  const [items, setItems] = useState<Auditoria[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    admin
      .fetchBitacora({ limit: 100 })
      .then((p) => {
        setItems(p.items);
        setTotal(p.total);
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes acceso a la bitácora (solo superadmin).
      </p>
    );
  }
  if (items === null) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{total} registros</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">Actor</th>
              <th className="p-3 font-medium">Acción</th>
              <th className="p-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b align-top last:border-0">
                <td className="whitespace-nowrap p-3 text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("es-MX", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="p-3">
                  <div>{a.actor_email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{a.actor_rol}</div>
                </td>
                <td className="p-3">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {a.accion}
                  </span>
                </td>
                <td className="p-3">
                  <div>{a.descripcion}</div>
                  {a.cambios && Object.keys(a.cambios).length > 0 ? (
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                      {JSON.stringify(a.cambios, null, 1)}
                    </pre>
                  ) : null}
                  {a.ip ? (
                    <div className="mt-1 text-xs text-muted-foreground">IP: {a.ip}</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
