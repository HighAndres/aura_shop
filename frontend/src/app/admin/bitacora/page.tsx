"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminFetch } from "@/lib/admin-api";
import type { AuditoriaEntry, AuditoriaPage } from "@/lib/types";

const PAGE_SIZE = 30;

export default function AdminBitacoraPage() {
  const [data, setData] = useState<AuditoriaPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filtroActor, setFiltroActor] = useState("");
  const [selected, setSelected] = useState<AuditoriaEntry | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (filtroActor) params.set("actor", filtroActor);

      const page = await adminFetch<AuditoriaPage>(
        `/audit?${params.toString()}`,
      );
      setData(page);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [offset, filtroActor]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Bitácora de auditoría</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Registro inmutable de acciones del personal
      </p>

      <div className="mt-4 mb-3">
        <Input
          placeholder="Filtrar por email del actor..."
          value={filtroActor}
          onChange={(e) => {
            setFiltroActor(e.target.value);
            setOffset(0);
          }}
          className="max-w-xs"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Entidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Sin registros de auditoría
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(entry)}
                >
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString("es-MX")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.actor_email ?? "—"}
                  </TableCell>
                  <TableCell>
                    {entry.actor_rol ? (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {entry.actor_rol}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {entry.accion}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-xs truncate">
                    {entry.descripcion}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.entidad
                      ? `${entry.entidad}${entry.entidad_id ? ` #${entry.entidad_id}` : ""}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total} registro(s) · Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog detalle */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de auditoría</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p>{new Date(selected.created_at).toLocaleString("es-MX")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actor</p>
                  <p>{selected.actor_email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rol</p>
                  <p className="capitalize">{selected.actor_rol ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IP</p>
                  <p className="font-mono">{selected.ip ?? "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Acción</p>
                <Badge variant="outline" className="font-mono">
                  {selected.accion}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Descripción</p>
                <p>{selected.descripcion}</p>
              </div>
              {selected.entidad && (
                <div>
                  <p className="text-muted-foreground">Entidad</p>
                  <p>
                    {selected.entidad}
                    {selected.entidad_id ? ` #${selected.entidad_id}` : ""}
                  </p>
                </div>
              )}
              {selected.cambios && (
                <div>
                  <p className="mb-1 text-muted-foreground">Cambios</p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-60">
                    {JSON.stringify(selected.cambios, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
