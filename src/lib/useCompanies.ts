"use client";

import { useCallback, useEffect, useState } from "react";
import type { Company } from "./companies";

async function errorOf(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export type CompanyInput = {
  cnpj: string;
  razaoSocial: string;
  groupId?: string | null;
};

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/companies")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Company[]) => {
        if (active) setCompanies(data);
      })
      .catch(() => {
        if (active) setCompanies([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Mexer nos grupos (renomear, excluir) muda o que a empresa mostra sem
  // passar por nenhum dos mutadores daqui — daí a recarga sob demanda.
  const refresh = useCallback(async () => {
    const res = await fetch("/api/companies");
    if (res.ok) setCompanies((await res.json()) as Company[]);
  }, []);

  const add = useCallback(async (input: CompanyInput) => {
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao cadastrar a empresa."));
    const created: Company = await res.json();
    setCompanies((prev) =>
      [created, ...(prev ?? [])].sort((a, b) =>
        a.razaoSocial.localeCompare(b.razaoSocial),
      ),
    );
    return created;
  }, []);

  const update = useCallback(async (id: string, input: CompanyInput) => {
    const res = await fetch(`/api/companies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao salvar as alterações."));
    const updated: Company = await res.json();
    setCompanies((prev) => (prev ?? []).map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao excluir a empresa."));
    setCompanies((prev) => (prev ?? []).filter((c) => c.id !== id));
  }, []);

  return {
    companies: companies ?? [],
    ready: companies !== null,
    add,
    update,
    remove,
    refresh,
  };
}
