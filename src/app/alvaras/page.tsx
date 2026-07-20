"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Inbox } from "lucide-react";
import {
  alvaraDaysLeft,
  alvaraStatus,
  type Alvara,
  type AlvaraStatus,
} from "@/lib/alvaras";
import { useAlvaras } from "@/lib/useAlvaras";
import { useVaultConfig } from "@/lib/vaultConfig";
import { useMe } from "@/lib/useMe";
import { useUrlState } from "@/lib/useUrlState";
import { toast, toastError } from "@/lib/toast";
import { SkeletonTable } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import AlvaraForm from "@/components/alvaras/AlvaraForm";
import AlvaraModal from "@/components/alvaras/AlvaraModal";
import AlvaraList from "@/components/alvaras/AlvaraList";

type Filter = "all" | AlvaraStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "valid", label: "Válidos" },
  { key: "expiring", label: "Vencendo" },
  { key: "expired", label: "Vencidos" },
  { key: "none", label: "Sem vencimento" },
];

const FILTER_KEYS = FILTERS.map((f) => f.key);

export default function AlvarasPage() {
  const { alvaras, ready, add, update, remove } = useAlvaras();
  const { alertDays } = useVaultConfig();
  const { can } = useMe();
  const canEdit = can("alvaras", "edit");
  // Busca e filtro vivem na URL: link compartilhável e reload sem perder contexto.
  const [query, setQuery] = useUrlState("q", "");
  const [filter, setFilter] = useUrlState<Filter>("status", "all", FILTER_KEYS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"closed" | "new" | "edit">("closed");
  const [editAlvara, setEditAlvara] = useState<Alvara | null>(null);

  // Deep-link vindo do dashboard: ?novo=1 abre o modal, ?alvara=id abre o detalhe.
  // Sincronização one-shot com a URL — o setState aqui é intencional.
  // Só esses dois parâmetros são consumidos e limpos; q/status ficam na URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("novo")) setModal("new");
    const alvaraId = params.get("alvara");
    if (alvaraId) setSelectedId(alvaraId);
    if (params.has("novo") || params.has("alvara")) {
      params.delete("novo");
      params.delete("alvara");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `/alvaras?${qs}` : "/alvaras");
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alvaras
      .filter((a) => filter === "all" || alvaraStatus(a, alertDays) === filter)
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          (a.number?.toLowerCase().includes(q) ?? false) ||
          (a.issuer?.toLowerCase().includes(q) ?? false) ||
          (a.company?.razaoSocial.toLowerCase().includes(q) ?? false),
      )
      .sort((a, b) => {
        // Com vencimento primeiro (mais urgente no topo); permanentes no fim.
        if (!a.expiresAt && !b.expiresAt) return a.name.localeCompare(b.name);
        if (!a.expiresAt) return 1;
        if (!b.expiresAt) return -1;
        return alvaraDaysLeft(a) - alvaraDaysLeft(b);
      });
  }, [alvaras, query, filter, alertDays]);

  const selected = alvaras.find((a) => a.id === selectedId) ?? null;

  async function handleSubmit(data: Omit<Alvara, "id">) {
    try {
      if (modal === "edit" && selected) {
        await update(selected.id, data);
        toast.success("Alvará atualizado.");
      } else {
        await add(data);
        toast.success("Alvará guardado no cofre.");
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
      toast.success("Alvará excluído do cofre.");
    } catch (err) {
      toastError(err, "Falha ao excluir.");
    }
  }

  // Edição precisa do PDF — busca a versão completa (quem edita).
  async function openEdit() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/alvaras/${selected.id}`);
      if (!res.ok) throw new Error("Sem permissão para editar.");
      setEditAlvara((await res.json()) as Alvara);
      setModal("edit");
    } catch (err) {
      toastError(err, "Falha ao abrir edição.");
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <header className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alvarás</h1>
          <p className="mt-1 text-sm text-ink-2">
            {ready
              ? `${alvaras.length} ${alvaras.length === 1 ? "alvará guardado" : "alvarás guardados"} no cofre.`
              : "Abrindo o cofre…"}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setModal("new")} className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Novo alvará
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
            placeholder="Buscar por tipo, número, empresa, órgão emissor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="vlt-segment">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              data-active={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {!ready ? (
        <SkeletonTable rows={6} cols={6} />
      ) : filtered.length === 0 ? (
        <div
          className="vlt-card anim-fade-up flex flex-col items-center gap-3 px-6 py-16 text-center"
          style={{ animationDelay: "120ms" }}
        >
          <Inbox className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            {alvaras.length === 0
              ? "Nenhum alvará no cofre. Guarde o primeiro."
              : "Nada encontrado com esses filtros."}
          </p>
        </div>
      ) : (
        <div className="anim-fade-up" style={{ animationDelay: "120ms" }}>
          <AlvaraList
            alvaras={filtered}
            alertDays={alertDays}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>
      )}

      {/* Modal de detalhes */}
      {selected && modal === "closed" && (
        <AlvaraModal
          alvara={selected}
          editor={canEdit}
          onClose={() => setSelectedId(null)}
          onEdit={openEdit}
          onDelete={() => handleDelete(selected.id)}
        />
      )}

      {/* Modal de cadastro/edição — quem edita alvarás */}
      {canEdit && modal !== "closed" && (
        <Modal
          title={modal === "edit" ? "Editar alvará" : "Novo alvará"}
          subtitle={
            modal === "edit"
              ? editAlvara?.name
              : "Digite os dados e anexe o PDF do documento."
          }
          onClose={() => setModal("closed")}
        >
          <AlvaraForm
            initial={modal === "edit" ? (editAlvara ?? undefined) : undefined}
            onSubmit={handleSubmit}
            onCancel={() => setModal("closed")}
          />
        </Modal>
      )}
    </div>
  );
}
