"use client";

import { useCallback, useEffect, useState } from "react";
import type { Access } from "./accesses";

async function errorOf(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

// `companyId` restringe ao cofre de uma empresa.
export function useAccesses(companyId?: string) {
  const [accesses, setAccesses] = useState<Access[] | null>(null);

  useEffect(() => {
    let active = true;
    const url = companyId
      ? `/api/accesses?companyId=${encodeURIComponent(companyId)}`
      : "/api/accesses";
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Access[]) => {
        if (active) setAccesses(data);
      })
      .catch(() => {
        if (active) setAccesses([]);
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  const add = useCallback(async (access: Omit<Access, "id">) => {
    const res = await fetch("/api/accesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(access),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao guardar o acesso."));
    const created: Access = await res.json();
    setAccesses((prev) =>
      [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }, []);

  const update = useCallback(async (id: string, access: Omit<Access, "id">) => {
    const res = await fetch(`/api/accesses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(access),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao salvar as alterações."));
    const updated: Access = await res.json();
    setAccesses((prev) => (prev ?? []).map((a) => (a.id === id ? updated : a)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/accesses/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Falha ao excluir o acesso.");
    setAccesses((prev) => (prev ?? []).filter((a) => a.id !== id));
  }, []);

  return { accesses: accesses ?? [], ready: accesses !== null, add, update, remove };
}
