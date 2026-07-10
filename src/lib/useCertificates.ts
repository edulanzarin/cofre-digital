"use client";

import { useCallback, useEffect, useState } from "react";
import type { Certificate } from "./certificates";

async function errorOf(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

// Camada de dados do cofre: consome a API REST (Postgres via Prisma).
export function useCertificates() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/certificates")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Certificate[]) => {
        if (active) setCerts(data);
      })
      .catch(() => {
        if (active) setCerts([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const add = useCallback(async (cert: Omit<Certificate, "id">) => {
    const res = await fetch("/api/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cert),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao guardar o certificado."));
    const created: Certificate = await res.json();
    setCerts((prev) => [created, ...(prev ?? [])]);
  }, []);

  const update = useCallback(async (id: string, cert: Omit<Certificate, "id">) => {
    const res = await fetch(`/api/certificates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cert),
    });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao salvar as alterações."));
    const updated: Certificate = await res.json();
    setCerts((prev) => (prev ?? []).map((c) => (c.id === id ? updated : c)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/certificates/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await errorOf(res, "Falha ao excluir o certificado."));
    setCerts((prev) => (prev ?? []).filter((c) => c.id !== id));
  }, []);

  return { certs: certs ?? [], ready: certs !== null, add, update, remove };
}
