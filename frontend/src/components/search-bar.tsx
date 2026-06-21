"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";

export function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) {
      router.push(`/productos?q=${encodeURIComponent(trimmed)}`);
      setQ("");
    }
  }

  return (
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
  );
}
