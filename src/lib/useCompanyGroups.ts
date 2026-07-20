"use client";

import { useCallback, useEffect, useState } from "react";
import type { CompanyGroup } from "./companyGroups";

async function errorOf(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

const byName = (a: CompanyGroup, b: CompanyGroup) => a.name.localeCompare(b.name);

export function useCompanyGroups() {
  const [groups, setGroups] = useState<CompanyGroup[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/company-groups")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: CompanyGroup[]) => {
        if (active) setGroups(data);
      })
      .catch(() => {
        if (active) setGroups([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Vincular uma empresa a um grupo acontece no cadastro da empresa e muda
  // a contagem daqui — por isso a recarga sob demanda.
  const refresh = useCallback(async () => {
    const res = await fetch("/api/company-groups");
    if (res.ok) setGroups((await res.json()) as CompanyGroup[]);
  }, []);

  const add = useCallback(async (name: string) => {
    const res = await fetch("/api/company-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao criar o grupo."));
    const created: CompanyGroup = await res.json();
    setGroups((prev) => [created, ...(prev ?? [])].sort(byName));
    return created;
  }, []);

  const rename = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/company-groups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao renomear o grupo."));
    const updated: CompanyGroup = await res.json();
    setGroups((prev) => (prev ?? []).map((g) => (g.id === id ? updated : g)).sort(byName));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/company-groups/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao excluir o grupo."));
    setGroups((prev) => (prev ?? []).filter((g) => g.id !== id));
  }, []);

  return {
    groups: groups ?? [],
    ready: groups !== null,
    add,
    rename,
    remove,
    refresh,
  };
}
