"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Inbox } from "lucide-react";
import {
  certStatus,
  daysLeft,
  docGroup,
  type Certificate,
  type CertStatus,
} from "@/lib/certificates";
import { useCertificates } from "@/lib/useCertificates";
import { useVaultConfig } from "@/lib/vaultConfig";
import { useMe } from "@/lib/useMe";
import { useUrlState } from "@/lib/useUrlState";
import { toast, toastError } from "@/lib/toast";
import { SkeletonTable } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import CertForm from "@/components/certificates/CertForm";
import CertModal from "@/components/certificates/CertModal";
import CertList from "@/components/certificates/CertList";

type Filter = "all" | CertStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "valid", label: "Válidos" },
  { key: "expiring", label: "Vencendo" },
  { key: "expired", label: "Vencidos" },
];

const FILTER_KEYS = FILTERS.map((f) => f.key);

// Eixo independente do de situação: dá para pedir "e-CPF vencendo".
// O que separa os dois é o documento (14 dígitos = CNPJ), não o tipo
// escrito no certificado — NF-e também é de CNPJ.
type DocFilter = "all" | "cnpj" | "cpf";

// "Ambos" e não "Todos": o segmentado de situação fica ao lado e dois
// "Todos" grudados não deixam claro qual eixo cada um zera.
const DOC_FILTERS: { key: DocFilter; label: string }[] = [
  { key: "all", label: "Ambos" },
  { key: "cnpj", label: "e-CNPJ" },
  { key: "cpf", label: "e-CPF" },
];

const DOC_FILTER_KEYS = DOC_FILTERS.map((f) => f.key);

export default function CertificatesPage() {
  const { certs, ready, add, update, remove } = useCertificates();
  const { alertDays } = useVaultConfig();
  const { can } = useMe();
  const canEdit = can("certificados", "edit");
  // Busca e filtro vivem na URL: o link fica compartilhável e recarregar
  // não joga o contexto fora.
  const [query, setQuery] = useUrlState("q", "");
  const [filter, setFilter] = useUrlState<Filter>("status", "all", FILTER_KEYS);
  const [docFilter, setDocFilter] = useUrlState<DocFilter>(
    "doc",
    "all",
    DOC_FILTER_KEYS,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"closed" | "new" | "edit">("closed");
  const [editCert, setEditCert] = useState<Certificate | null>(null);

  // Deep-link vindo do dashboard: ?novo=1 abre o modal, ?cert=id abre o drawer.
  // Sincronização one-shot com a URL — o setState aqui é intencional.
  // Só esses dois parâmetros são consumidos e limpos; q/status ficam na URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("novo")) setModal("new");
    const certId = params.get("cert");
    if (certId) setSelectedId(certId);
    if (params.has("novo") || params.has("cert")) {
      params.delete("novo");
      params.delete("cert");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `/certificados?${qs}` : "/certificados",
      );
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return certs
      .filter((c) => filter === "all" || certStatus(c, alertDays) === filter)
      .filter((c) => docFilter === "all" || docGroup(c) === docFilter)
      .filter(
        (c) =>
          !q ||
          c.holder.toLowerCase().includes(q) ||
          c.document.toLowerCase().includes(q) ||
          c.issuer.toLowerCase().includes(q) ||
          c.type.toLowerCase().includes(q) ||
          (c.company?.razaoSocial.toLowerCase().includes(q) ?? false),
      )
      .sort((a, b) => daysLeft(a) - daysLeft(b));
  }, [certs, query, filter, docFilter, alertDays]);

  const selected = certs.find((c) => c.id === selectedId) ?? null;

  async function handleSubmit(data: Omit<Certificate, "id">) {
    try {
      if (modal === "edit" && selected) {
        await update(selected.id, data);
        toast.success("Certificado atualizado.");
      } else {
        await add(data);
        toast.success("Certificado guardado no cofre.");
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
      toast.success("Certificado excluído do cofre.");
    } catch (err) {
      toastError(err, "Falha ao excluir.");
    }
  }

  // Edição precisa da senha e do arquivo — busca a versão completa (quem edita).
  async function openEdit() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/certificates/${selected.id}`);
      if (!res.ok) throw new Error("Sem permissão para editar.");
      setEditCert((await res.json()) as Certificate);
      setModal("edit");
    } catch (err) {
      toastError(err, "Falha ao abrir edição.");
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <header className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Certificados</h1>
        {canEdit && (
          <button onClick={() => setModal("new")} className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Novo certificado
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
            placeholder="Buscar por titular, documento, empresa, emissor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="vlt-segment">
          {DOC_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              data-active={docFilter === key}
              onClick={() => setDocFilter(key)}
            >
              {label}
            </button>
          ))}
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
        <SkeletonTable rows={6} cols={7} />
      ) : filtered.length === 0 ? (
        <div
          className="vlt-card anim-fade-up flex flex-col items-center gap-3 px-6 py-16 text-center"
          style={{ animationDelay: "120ms" }}
        >
          <Inbox className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            {certs.length === 0
              ? "O cofre está vazio. Guarde o primeiro certificado."
              : "Nada encontrado com esses filtros."}
          </p>
        </div>
      ) : (
        <div className="anim-fade-up" style={{ animationDelay: "120ms" }}>
          <CertList
            certs={filtered}
            alertDays={alertDays}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>
      )}

      {/* Modal de detalhes */}
      {selected && modal === "closed" && (
        <CertModal
          cert={selected}
          editor={canEdit}
          onClose={() => setSelectedId(null)}
          onEdit={openEdit}
          onDelete={() => handleDelete(selected.id)}
        />
      )}

      {/* Modal de cadastro/edição — quem edita certificados */}
      {canEdit && modal !== "closed" && (
        <Modal
          title={modal === "edit" ? "Editar certificado" : "Novo certificado"}
          subtitle={
            modal === "edit"
              ? editCert?.holder
              : "Os dados ficam guardados com segurança no cofre."
          }
          onClose={() => setModal("closed")}
        >
          <CertForm
            initial={modal === "edit" ? (editCert ?? undefined) : undefined}
            onSubmit={handleSubmit}
            onCancel={() => setModal("closed")}
          />
        </Modal>
      )}
    </div>
  );
}
