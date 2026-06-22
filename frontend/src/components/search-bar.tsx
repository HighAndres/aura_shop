"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) {
      router.push(`/productos?q=${encodeURIComponent(trimmed)}`);
      setQ("");
      setOpen(false);
    }
  }

  return (
    <>
      {/* Desktop: inline search */}
      <form onSubmit={onSubmit} className="relative hidden sm:block">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar productos..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 w-44 pl-8 text-sm lg:w-56"
        />
      </form>

      {/* Mobile: icon toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="Buscar"
      >
        <Search className="h-5 w-5" />
      </Button>

      {/* Mobile: expanded search overlay */}
      {open && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center gap-2 border-b bg-background px-3 py-2 shadow-md sm:hidden animate-fade-in">
          <form onSubmit={onSubmit} className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="search"
              placeholder="Buscar productos..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-full pl-8 text-sm"
              autoFocus
            />
          </form>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setOpen(false); setQ(""); }}
            aria-label="Cerrar búsqueda"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}
    </>
  );
}
