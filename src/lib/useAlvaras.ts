"use client";

import { useCallback, useEffect, useState } from "react";
import type { Alvara } from "./alvaras";

async function errorOf(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

// Camada de dados dos alvarás: consome a API REST (Postgres via Prisma).
// `companyId` restringe ao cofre de uma empresa.
export function useAlvaras(companyId?: string) {
  const [alvaras, setAlvaras] = useState<Alvara[] | null>(null);

  useEffect(() => {
    let active = true;
    const url = companyId
      ? `/api/alvaras?companyId=${encodeURIComponent(companyId)}`
      : "/api/alvaras";
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Alvara[]) => {
        if (active) setAlvaras(data);
      })
      .catch(() => {
        if (active) setAlvaras([]);
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  const add = useCallback(async (alvara: Omit<Alvara, "id">) => {
    const res = await fetch("/api/alvaras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alvara),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao guardar o alvará."));
    const created: Alvara = await res.json();
    setAlvaras((prev) => [created, ...(prev ?? [])]);
  }, []);

  const update = useCallback(async (id: string, alvara: Omit<Alvara, "id">) => {
    const res = await fetch(`/api/alvaras/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alvara),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao salvar as alterações."));
    const updated: Alvara = await res.json();
    setAlvaras((prev) => (prev ?? []).map((a) => (a.id === id ? updated : a)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/alvaras/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao excluir o alvará."));
    setAlvaras((prev) => (prev ?? []).filter((a) => a.id !== id));
  }, []);

  return { alvaras: alvaras ?? [], ready: alvaras !== null, add, update, remove };
}
