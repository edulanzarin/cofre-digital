"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Inbox,
  Network,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCompanyGroups } from "@/lib/useCompanyGroups";
import { useMe } from "@/lib/useMe";
import { useUrlState } from "@/lib/useUrlState";
import { toast, toastError } from "@/lib/toast";
import { SkeletonCards } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";

export default function GroupsPage() {
  const { groups, ready, add, rename, remove } = useCompanyGroups();
  const { can } = useMe();
  const canEdit = can("empresas", "edit");
  const [query, setQuery] = useUrlState("q", "");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [groups, query]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await add(name.trim());
      setName("");
      setCreating(false);
      toast.success("Grupo criado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar o grupo.");
    }
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return;
    try {
      await rename(id, editingName.trim());
      setEditingId(null);
    } catch (err) {
      toastError(err, "Falha ao renomear o grupo.");
    }
  }

  // Excluir não apaga empresa nenhuma — elas só voltam a ficar sem grupo.
  async function handleRemove(id: string, companyCount: number) {
    try {
      await remove(id);
      toast.success(
        companyCount === 0
          ? "Grupo excluído."
          : `Grupo excluído — ${companyCount} ${
              companyCount === 1 ? "empresa ficou" : "empresas ficaram"
            } sem grupo.`,
      );
    } catch (err) {
      toastError(err, "Falha ao excluir o grupo.");
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <header className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Grupos</h1>
        {canEdit && (
          <button
            onClick={() => {
              setName("");
              setError("");
              setCreating(true);
            }}
            className="vlt-btn vlt-btn-primary"
          >
            <Plus className="size-4" />
            Novo grupo
          </button>
        )}
      </header>

      {/* Busca — a lista cresce rápido quando cada cliente vira um grupo */}
      {groups.length > 8 && (
        <div className="anim-fade-up mb-5" style={{ animationDelay: "60ms" }}>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input
              className="vlt-input pl-9"
              placeholder="Buscar grupo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Lista */}
      {!ready ? (
        <SkeletonCards rows={4} className="h-14" />
      ) : filtered.length === 0 ? (
        <div
          className="vlt-card anim-fade-up flex flex-col items-center gap-3 px-6 py-16 text-center"
          style={{ animationDelay: "120ms" }}
        >
          <Inbox className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="max-w-sm text-sm text-ink-2">
            {groups.length === 0
              ? "Nenhum grupo ainda. Crie um para juntar as empresas do mesmo dono e filtrar todas de uma vez."
              : "Nada encontrado com essa busca."}
          </p>
        </div>
      ) : (
        <ul
          className="vlt-card anim-fade-up divide-y divide-line"
          style={{ animationDelay: "120ms" }}
        >
          {filtered.map((group) => (
            <li key={group.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Network className="size-4" strokeWidth={1.8} />
              </div>

              {editingId === group.id ? (
                <>
                  <input
                    className="vlt-input flex-1"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRename(group.id);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                  <button
                    className="vlt-icon-btn"
                    title="Salvar"
                    onClick={() => handleRename(group.id)}
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    className="vlt-icon-btn"
                    title="Cancelar"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  {/* O grupo só existe para levar às empresas dele */}
                  <Link
                    href={`/empresas?grupo=${group.id}`}
                    className="group/row flex min-w-0 flex-1 items-center gap-2"
                  >
                    <span className="truncate text-sm font-medium">{group.name}</span>
                    <span className="shrink-0 text-[0.72rem] text-ink-3">
                      {group.companyCount}{" "}
                      {group.companyCount === 1 ? "empresa" : "empresas"}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover/row:opacity-100" />
                  </Link>
                  {canEdit && (
                    <>
                      <button
                        className="vlt-icon-btn"
                        title="Renomear"
                        onClick={() => {
                          setEditingId(group.id);
                          setEditingName(group.name);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        className="vlt-icon-btn hover:!text-bad"
                        title="Excluir grupo"
                        onClick={() => handleRemove(group.id, group.companyCount)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Modal de cadastro */}
      {canEdit && creating && (
        <Modal
          title="Novo grupo"
          subtitle="Junte empresas do mesmo dono para filtrar todas de uma vez."
          onClose={() => setCreating(false)}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">
                Nome do grupo
              </span>
              <input
                className="vlt-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Grupo Silva"
                required
                autoFocus
              />
            </label>

            {error && <p className="text-xs text-bad">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="vlt-btn vlt-btn-ghost"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="vlt-btn vlt-btn-primary"
                disabled={!name.trim()}
              >
                Criar grupo
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
