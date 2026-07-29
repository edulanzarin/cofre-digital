"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Inbox, KeyRound } from "lucide-react";
import { LOGIN_TYPES, type Access } from "@/lib/accesses";
import { useAccesses } from "@/lib/useAccesses";
import { useMe } from "@/lib/useMe";
import { useUrlState } from "@/lib/useUrlState";
import { toast, toastError } from "@/lib/toast";
import { SkeletonTable } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import AccessForm from "@/components/accesses/AccessForm";
import AccessList from "@/components/accesses/AccessList";
import AccessModal from "@/components/accesses/AccessModal";

const TYPE_KEYS = ["all", ...LOGIN_TYPES] as const;
type TypeFilter = (typeof TYPE_KEYS)[number];

export default function AccessesPage() {
  const { accesses, ready, add, update, remove } = useAccesses();
  const { can } = useMe();
  const editor = can("acessos", "edit");
  // Busca e filtro moram na URL: link compartilhável e reload sem perder contexto.
  const [query, setQuery] = useUrlState("q", "");
  const [typeFilter, setTypeFilter] = useUrlState<TypeFilter>(
    "tipo",
    "all",
    TYPE_KEYS,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"closed" | "new" | "edit">("closed");
  const [editAccess, setEditAccess] = useState<Access | null>(null);

  // Deep-link: ?novo=1 abre o cadastro, ?acesso=id abre o detalhe. Consome e
  // limpa só esses dois; q/tipo ficam na URL. Sincronização one-shot.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("novo")) setModal("new");
    const acessoId = params.get("acesso");
    if (acessoId) setSelectedId(acessoId);
    if (params.has("novo") || params.has("acesso")) {
      params.delete("novo");
      params.delete("acesso");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `/acessos?${qs}` : "/acessos");
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accesses
      .filter((a) => typeFilter === "all" || a.loginType === typeFilter)
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          a.url.toLowerCase().includes(q) ||
          a.loginValue.toLowerCase().includes(q) ||
          a.loginType.toLowerCase().includes(q) ||
          (a.company?.razaoSocial.toLowerCase().includes(q) ?? false),
      );
  }, [accesses, query, typeFilter]);

  // Coluna Empresa só quando algum acesso tem empresa dona (senão é coluna morta).
  const showCompany = useMemo(() => accesses.some((a) => a.company), [accesses]);
  const selected = accesses.find((a) => a.id === selectedId) ?? null;

  async function handleSubmit(data: Omit<Access, "id">) {
    try {
      if (modal === "edit" && selected) {
        await update(selected.id, data);
        toast.success("Acesso atualizado.");
      } else {
        await add(data);
        toast.success("Acesso guardado no cofre.");
      }
      setModal("closed");
    } catch (err) {
      toastError(err, "Falha ao salvar.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove(id);
      setSelectedId(null);
      toast.success("Acesso excluído do cofre.");
    } catch (err) {
      toastError(err, "Falha ao excluir.");
    }
  }

  // Edição precisa da senha e do tutorial — busca a versão completa (quem edita).
  async function openEdit() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/accesses/${selected.id}`);
      if (!res.ok) throw new Error("Sem permissão para editar.");
      setEditAccess((await res.json()) as Access);
      setModal("edit");
    } catch (err) {
      toastError(err, "Falha ao abrir edição.");
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <header className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Acessos</h1>
        {editor && (
          <button onClick={() => setModal("new")} className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Novo acesso
          </button>
        )}
      </header>

      {/* Busca + filtro */}
      <div
        className="anim-fade-up mb-5 flex flex-wrap items-center gap-3"
        style={{ animationDelay: "60ms" }}
      >
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input
            className="vlt-input pl-9"
            placeholder="Buscar por nome, site, login, empresa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <select
            className="vlt-input w-52 pl-9"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            <option value="all">Todos os tipos de login</option>
            {LOGIN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista */}
      {!ready ? (
        <SkeletonTable rows={6} cols={showCompany ? 6 : 5} />
      ) : filtered.length === 0 ? (
        <div
          className="vlt-card anim-fade-up flex flex-col items-center gap-3 px-6 py-16 text-center"
          style={{ animationDelay: "120ms" }}
        >
          <Inbox className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            {accesses.length === 0
              ? "Nenhum acesso guardado ainda."
              : "Nada encontrado com esses filtros."}
          </p>
        </div>
      ) : (
        <div className="anim-fade-up" style={{ animationDelay: "120ms" }}>
          <AccessList
            accesses={filtered}
            onSelect={(id) => setSelectedId(id)}
            showCompany={showCompany}
          />
        </div>
      )}

      {/* Modal de detalhes */}
      {selected && modal === "closed" && (
        <AccessModal
          key={selected.id}
          access={selected}
          editor={editor}
          onClose={() => setSelectedId(null)}
          onEdit={openEdit}
          onDelete={() => handleDelete(selected.id)}
        />
      )}

      {/* Modal de cadastro/edição — quem edita acessos */}
      {editor && modal !== "closed" && (
        <Modal
          wide
          title={modal === "edit" ? "Editar acesso" : "Novo acesso"}
          subtitle={modal === "edit" ? editAccess?.name : undefined}
          onClose={() => setModal("closed")}
        >
          <AccessForm
            initial={modal === "edit" ? (editAccess ?? undefined) : undefined}
            onSubmit={handleSubmit}
            onCancel={() => setModal("closed")}
          />
        </Modal>
      )}
    </div>
  );
}
