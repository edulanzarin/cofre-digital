"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Globe, Inbox, BookOpen } from "lucide-react";
import type { Access } from "@/lib/accesses";
import { useAccesses } from "@/lib/useAccesses";
import { useMe } from "@/lib/useMe";
import { useUrlState } from "@/lib/useUrlState";
import { toast, toastError } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import AccessForm from "@/components/accesses/AccessForm";

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function AccessesPage() {
  const { accesses, ready, add } = useAccesses();
  const { can } = useMe();
  const editor = can("acessos", "edit");
  // Busca na URL: link compartilhável e reload sem perder o contexto.
  const [query, setQuery] = useUrlState("q", "");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accesses.filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.url.toLowerCase().includes(q) ||
        a.loginValue.toLowerCase().includes(q) ||
        a.loginType.toLowerCase().includes(q),
    );
  }, [accesses, query]);

  async function handleCreate(data: Omit<Access, "id">) {
    try {
      await add(data);
      setCreating(false);
      toast.success("Acesso guardado no cofre.");
    } catch (err) {
      toastError(err, "Falha ao salvar.");
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <header className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Acessos</h1>
        {editor && (
          <button onClick={() => setCreating(true)} className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Novo acesso
          </button>
        )}
      </header>

      {/* Busca */}
      <div className="anim-fade-up mb-5" style={{ animationDelay: "60ms" }}>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input
            className="vlt-input pl-9"
            placeholder="Buscar por nome, site, login…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Lista */}
      {!ready ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i}>
              <Skeleton className="h-28 w-full" />
            </li>
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div
          className="vlt-card anim-fade-up flex flex-col items-center gap-3 px-6 py-16 text-center"
          style={{ animationDelay: "120ms" }}
        >
          <Inbox className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            {accesses.length === 0
              ? "Nenhum acesso guardado ainda."
              : "Nada encontrado com essa busca."}
          </p>
        </div>
      ) : (
        <ul
          className="anim-fade-up grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          style={{ animationDelay: "120ms" }}
        >
          {filtered.map((access) => (
            <li key={access.id}>
              <Link
                href={`/acessos/${access.id}`}
                className="vlt-card vlt-card-hover block w-full p-5 text-left"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
                    <Globe className="size-4.5" strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{access.name}</p>
                    <p className="mt-0.5 truncate font-mono text-[0.7rem] text-ink-3">
                      {hostOf(access.url)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[0.72rem] text-ink-3">
                  <span className="vlt-badge bg-panel-2 !text-[0.65rem] text-ink-2">
                    {access.loginType}
                  </span>
                  {access.hasTutorial && (
                    <span className="flex items-center gap-1 text-brand">
                      <BookOpen className="size-3.5" />
                      Manual
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de cadastro — quem edita acessos */}
      {editor && creating && (
        <Modal
          wide
          title="Novo acesso"
          subtitle="Site, credenciais e o manual de como acessar."
          onClose={() => setCreating(false)}
        >
          <AccessForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
