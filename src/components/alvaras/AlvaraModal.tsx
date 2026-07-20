"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Pencil,
  Trash2,
  FileBadge,
  FileText,
  CalendarClock,
  Infinity as InfinityIcon,
  Download,
  ExternalLink,
  Building2,
} from "lucide-react";
import Link from "next/link";
import {
  alvaraDaysLeft,
  alvaraStatus,
  ALVARA_STATUS_META,
  type Alvara,
} from "@/lib/alvaras";
import { formatDate } from "@/lib/certificates";
import { useVaultConfig } from "@/lib/vaultConfig";
import AlvaraBadge from "@/components/alvaras/AlvaraBadge";
import HistoryPanel from "@/components/ui/HistoryPanel";

// Quanto da vigência já passou (só quando emissão e vencimento existem).
function lifePercent(alvara: Alvara): number | null {
  if (!alvara.issuedAt || !alvara.expiresAt) return null;
  const start = new Date(alvara.issuedAt).getTime();
  const end = new Date(alvara.expiresAt).getTime();
  if (end <= start) return null;
  const p = ((Date.now() - start) / (end - start)) * 100;
  return Math.min(100, Math.max(0, p));
}

// Detalhe do alvará em modal amplo: dados à esquerda, linha do tempo
// à direita — mesmo formato do modal de certificados.
export default function AlvaraModal({
  alvara,
  editor,
  onClose,
  onEdit,
  onDelete,
}: {
  alvara: Alvara;
  editor: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { alertDays } = useVaultConfig();
  const [mounted, setMounted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Portal só existe no cliente — o setState aqui é intencional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const status = alvaraStatus(alvara, alertDays);
  const meta = ALVARA_STATUS_META[status];
  const d = alvaraDaysLeft(alvara);
  const life = lifePercent(alvara);

  if (!mounted) return null;

  return createPortal(
    <div
      className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="vlt-card anim-pop flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden shadow-(--shadow-float)">
        {/* Cabeçalho */}
        <div className="flex items-start gap-4 border-b border-line px-6 py-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: meta.soft, color: meta.color }}
          >
            <FileBadge className="size-5.5" strokeWidth={1.7} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1.05rem] leading-snug font-semibold tracking-tight">
              {alvara.name}
            </h2>
            {alvara.number && (
              <p className="mt-0.5 font-mono text-xs text-ink-3">
                Nº {alvara.number}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AlvaraBadge alvara={alvara} />
              {alvara.issuer && (
                <span className="vlt-badge bg-panel-2 text-ink-2">
                  {alvara.issuer}
                </span>
              )}
              {alvara.company && (
                <Link
                  href={`/empresas/${alvara.company.id}`}
                  onClick={onClose}
                  className="vlt-badge bg-brand-soft text-brand transition-opacity hover:opacity-80"
                  title="Abrir o cofre da empresa"
                >
                  <Building2 className="size-3" />
                  {alvara.company.razaoSocial}
                </Link>
              )}
            </div>
          </div>
          <button onClick={onClose} className="vlt-icon-btn -mr-2" title="Fechar">
            <X className="size-4" />
          </button>
        </div>

        {/* Corpo: dados | histórico */}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_21rem]">
          {/* Coluna de dados */}
          <div className="min-h-0 overflow-y-auto px-6 py-5">
            {/* Vigência */}
            <div
              className="rounded-xl border border-line px-4 py-3.5"
              style={{ background: meta.soft }}
            >
              <div className="flex items-center gap-3">
                {status === "none" ? (
                  <InfinityIcon
                    className="size-4 shrink-0"
                    style={{ color: meta.color }}
                  />
                ) : (
                  <CalendarClock
                    className="size-4 shrink-0"
                    style={{ color: meta.color }}
                  />
                )}
                <p className="text-xs" style={{ color: meta.color }}>
                  {status === "none"
                    ? "Sem data de vencimento — alvará permanente."
                    : status === "expired"
                      ? `Venceu em ${formatDate(alvara.expiresAt!)}, há ${Math.abs(d)} dias.`
                      : `Vence em ${formatDate(alvara.expiresAt!)} — faltam ${d} dias.`}
                </p>
              </div>
              {life !== null && (
                <>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${life}%`, background: meta.color }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[0.65rem] text-ink-3">
                    <span>{formatDate(alvara.issuedAt!)}</span>
                    <span>{Math.round(life)}% decorrido</span>
                    <span>{formatDate(alvara.expiresAt!)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Campos */}
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Row label="Número" value={alvara.number ?? "—"} />
              <Row label="Órgão emissor" value={alvara.issuer ?? "—"} />
              <Row
                label="Emitido em"
                value={alvara.issuedAt ? formatDate(alvara.issuedAt) : "—"}
              />
              <Row
                label="Vence em"
                value={alvara.expiresAt ? formatDate(alvara.expiresAt) : "Sem vencimento"}
              />
              {alvara.createdAt && (
                <Row label="No cofre desde" value={formatDate(alvara.createdAt)} />
              )}
              {alvara.updatedAt && (
                <Row label="Última alteração" value={formatDate(alvara.updatedAt)} />
              )}
            </dl>

            {/* PDF do documento */}
            <div className="mt-5">
              <p className="mb-1.5 text-xs font-medium text-ink-2">Documento</p>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3.5 py-3">
                <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={1.7} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[0.78rem]">
                    {alvara.fileName || "alvara.pdf"}
                  </p>
                  {!alvara.hasFile && (
                    <p className="text-[0.68rem] text-ink-3">
                      {editor
                        ? "PDF não anexado — edite para enviar o arquivo."
                        : "PDF não anexado."}
                    </p>
                  )}
                </div>
                {alvara.hasFile && (
                  <>
                    <a
                      href={`/api/alvaras/${alvara.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs"
                    >
                      <ExternalLink className="size-3.5" />
                      Abrir
                    </a>
                    <a
                      href={`/api/alvaras/${alvara.id}/file`}
                      download={alvara.fileName || "alvara.pdf"}
                      className="vlt-btn vlt-btn-primary !px-3 !py-1.5 text-xs"
                    >
                      <Download className="size-3.5" />
                      Baixar
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Observações fixas do cadastro */}
            {alvara.notes && (
              <div className="mt-5">
                <p className="mb-1.5 text-xs font-medium text-ink-2">Observações</p>
                <p className="rounded-xl border border-line bg-panel-2 px-3.5 py-3 text-[0.82rem] leading-relaxed text-ink-2 whitespace-pre-wrap">
                  {alvara.notes}
                </p>
              </div>
            )}
          </div>

          {/* Coluna do histórico */}
          <div className="flex min-h-0 flex-col border-t border-line bg-panel-2/30 lg:border-t-0 lg:border-l">
            <HistoryPanel
              key={alvara.id}
              endpoint={`/api/alvaras/${alvara.id}/events`}
              placeholder="Escreva uma observação… (ex.: foi cobrado do cliente, renovação em andamento)"
            />
          </div>
        </div>

        {/* Rodapé de ações */}
        {editor && (
          <div className="flex items-center justify-between gap-2 border-t border-line px-6 py-3.5">
            {confirmDelete ? (
              <>
                <p className="text-xs text-ink-2">Excluir do cofre? O histórico vai junto.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onDelete}
                    className="vlt-btn vlt-btn-danger !px-3 !py-1.5 text-xs"
                  >
                    Excluir
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="vlt-btn vlt-btn-danger !px-3"
                >
                  <Trash2 className="size-4" />
                  Excluir
                </button>
                <button onClick={onEdit} className="vlt-btn vlt-btn-ghost">
                  <Pencil className="size-4" />
                  Editar
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate text-sm">{value}</dd>
    </div>
  );
}
