"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  FileKey2,
  CreditCard,
  CalendarClock,
  Download,
  Building2,
  Globe,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  certStatus,
  daysLeft,
  docGroup,
  formatDate,
  lifePercent,
  STATUS_META,
  type Certificate,
} from "@/lib/certificates";
import type { Access } from "@/lib/accesses";
import { useSettings } from "@/lib/settings";
import { useVaultConfig } from "@/lib/vaultConfig";
import { useMe } from "@/lib/useMe";
import ExpiryRing from "@/components/ui/ExpiryRing";
import StatusBadge from "@/components/ui/StatusBadge";
import CertHistory from "@/components/certificates/CertHistory";

// "válido por 12 meses" / "válido por 3 anos"
function validityLabel(cert: Pick<Certificate, "issuedAt" | "expiresAt">): string {
  const days =
    (new Date(cert.expiresAt).getTime() - new Date(cert.issuedAt).getTime()) /
    (24 * 60 * 60 * 1000);
  const months = Math.round(days / 30.44);
  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return `válido por ${years} ${years === 1 ? "ano" : "anos"}`;
  }
  return `válido por ${months} meses`;
}

// Detalhe do certificado em modal amplo: dados à esquerda, linha do
// tempo à direita — substitui o antigo drawer lateral.
export default function CertModal({
  cert,
  editor,
  onClose,
  onEdit,
  onDelete,
}: {
  cert: Certificate;
  editor: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { confirmReveal } = useSettings();
  const { alertDays } = useVaultConfig();
  const { can } = useMe();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [askingReveal, setAskingReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Acessos que fazem login com este certificado (FK certificateId).
  const [linkedAccesses, setLinkedAccesses] = useState<Access[] | null>(null);

  useEffect(() => {
    if (!can("acessos")) return;
    let active = true;
    fetch("/api/accesses")
      .then((r) => (r.ok ? (r.json() as Promise<Access[]>) : []))
      .then((data) => {
        if (active) {
          setLinkedAccesses(data.filter((a) => a.certificateId === cert.id));
        }
      })
      .catch(() => {
        if (active) setLinkedAccesses([]);
      });
    return () => {
      active = false;
    };
  }, [cert.id, can]);

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

  const status = certStatus(cert, alertDays);
  const d = daysLeft(cert);
  const isCard = cert.media === "card";

  async function fetchPassword(): Promise<string | null> {
    try {
      const res = await fetch(`/api/certificates/${cert.id}/password`);
      if (!res.ok) return null;
      const body = (await res.json()) as { password: string };
      return body.password;
    } catch {
      return null;
    }
  }

  // Revelar: só quem edita vê esse botão; respeita "confirmar antes".
  async function toggleReveal() {
    if (revealed !== null) {
      setRevealed(null);
      return;
    }
    if (confirmReveal && !askingReveal) {
      setAskingReveal(true);
      return;
    }
    setAskingReveal(false);
    setRevealed(await fetchPassword());
  }

  // Copiar: quem vê pode, sem exibir a senha.
  async function copyPassword() {
    const password = revealed ?? (await fetchPassword());
    if (password === null) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard bloqueado: sem feedback
    }
  }

  return createPortal(
    <div
      className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="vlt-card anim-pop flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden shadow-(--shadow-float)">
        {/* Cabeçalho */}
        <div className="flex items-start gap-4 border-b border-line px-6 py-4">
          <div className="relative shrink-0">
            <ExpiryRing cert={cert} size={52} />
            {isCard ? (
              <CreditCard
                className="absolute inset-0 m-auto size-4.5 text-ink-2"
                strokeWidth={1.6}
              />
            ) : (
              <FileKey2
                className="absolute inset-0 m-auto size-4.5 text-ink-2"
                strokeWidth={1.6}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1.05rem] leading-snug font-semibold tracking-tight">
              {cert.holder}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-ink-3">{cert.document}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge cert={cert} />
              <span className="vlt-badge bg-panel-2 text-ink-2">{cert.type}</span>
              {cert.company && (
                <Link
                  href={`/empresas/${cert.company.id}`}
                  onClick={onClose}
                  className="vlt-badge bg-brand-soft text-brand transition-opacity hover:opacity-80"
                  title="Abrir o cofre da empresa"
                >
                  <Building2 className="size-3" />
                  {cert.company.razaoSocial}
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
            {/* Vida do certificado */}
            <div
              className="rounded-xl border border-line px-4 py-3.5"
              style={{ background: STATUS_META[status].soft }}
            >
              <div className="flex items-center gap-3">
                <CalendarClock
                  className="size-4 shrink-0"
                  style={{ color: STATUS_META[status].color }}
                />
                <p className="text-xs" style={{ color: STATUS_META[status].color }}>
                  {status === "expired"
                    ? `Venceu em ${formatDate(cert.expiresAt)}, há ${Math.abs(d)} dias.`
                    : `Vence em ${formatDate(cert.expiresAt)} — faltam ${d} dias.`}
                </p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${lifePercent(cert)}%`,
                    background: STATUS_META[status].color,
                  }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[0.65rem] text-ink-3">
                <span>{formatDate(cert.issuedAt)}</span>
                <span>
                  {Math.round(lifePercent(cert))}% decorrido · {validityLabel(cert)}
                </span>
                <span>{formatDate(cert.expiresAt)}</span>
              </div>
            </div>

            {/* Campos */}
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Row label="Tipo" value={cert.type} />
              <Row
                label="Titularidade"
                value={
                  docGroup(cert) === "cnpj" ? "Pessoa jurídica" : "Pessoa física"
                }
              />
              <Row
                label="Mídia"
                value={isCard ? "Cartão / token físico" : "Arquivo digital"}
              />
              <Row label="Autoridade certificadora" value={cert.issuer} />
              {cert.createdAt && (
                <Row label="No cofre desde" value={formatDate(cert.createdAt)} />
              )}
              {cert.updatedAt && (
                <Row label="Última alteração" value={formatDate(cert.updatedAt)} />
              )}
            </dl>

            {/* Arquivo */}
            {!isCard && (
              <div className="mt-5">
                <p className="mb-1.5 text-xs font-medium text-ink-2">Arquivo</p>
                <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3.5 py-3">
                  <FileKey2 className="size-4 shrink-0 text-ink-3" strokeWidth={1.7} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[0.78rem]">
                      {cert.fileName || "certificado.pfx"}
                    </p>
                    {!cert.hasFile && (
                      <p className="text-[0.68rem] text-ink-3">
                        {editor
                          ? "Arquivo não anexado — edite para enviar o .pfx."
                          : "Arquivo não anexado."}
                      </p>
                    )}
                  </div>
                  {cert.hasFile && (
                    <a
                      href={`/api/certificates/${cert.id}/file`}
                      className="vlt-btn vlt-btn-primary !px-3 !py-1.5 text-xs"
                    >
                      <Download className="size-3.5" />
                      Baixar
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Senha */}
            <div className="mt-5">
              <p className="mb-1.5 text-xs font-medium text-ink-2">Senha</p>
              <div className="flex items-center gap-1 rounded-xl border border-line bg-panel-2 px-3 py-1.5">
                {askingReveal ? (
                  <>
                    <span className="flex-1 text-xs text-ink-2">Revelar a senha?</span>
                    <button
                      onClick={() => setAskingReveal(false)}
                      className="vlt-btn vlt-btn-ghost !px-2.5 !py-1 text-xs"
                    >
                      Não
                    </button>
                    <button
                      onClick={toggleReveal}
                      className="vlt-btn vlt-btn-primary !px-2.5 !py-1 text-xs"
                    >
                      Revelar
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate font-mono text-sm">
                      {revealed ?? "••••••••••••"}
                    </span>
                    {editor && (
                      <button
                        onClick={toggleReveal}
                        className="vlt-icon-btn"
                        title={revealed !== null ? "Ocultar" : "Revelar"}
                      >
                        {revealed !== null ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={copyPassword}
                      className="vlt-icon-btn"
                      title="Copiar senha"
                    >
                      {copied ? (
                        <Check className="size-4 text-ok" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </button>
                  </>
                )}
              </div>
              {!editor && (
                <p className="mt-1.5 text-[0.68rem] text-ink-3">
                  Seu perfil pode copiar a senha, mas não visualizá-la.
                </p>
              )}
            </div>

            {/* Onde este certificado é usado para entrar */}
            {can("acessos") && (
              <div className="mt-5">
                <p className="mb-1.5 text-xs font-medium text-ink-2">
                  Usado nos acessos
                  {linkedAccesses && linkedAccesses.length > 0 && (
                    <span className="ml-1.5 font-normal text-ink-3">
                      ({linkedAccesses.length})
                    </span>
                  )}
                </p>
                {linkedAccesses === null ? (
                  <div className="h-12 animate-pulse rounded-xl bg-panel-2/60" />
                ) : linkedAccesses.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line px-3.5 py-3 text-[0.72rem] text-ink-3">
                    Nenhum acesso entra com este certificado. Vincule em
                    Acessos → “Entrar com: Certificado digital”.
                  </p>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel-2">
                    {linkedAccesses.map((access) => (
                      <li key={access.id}>
                        <Link
                          href={`/acessos/${access.id}`}
                          onClick={onClose}
                          className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-panel"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
                            <Globe className="size-3.5" strokeWidth={1.7} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.82rem] font-medium">
                              {access.name}
                            </span>
                            <span className="block truncate font-mono text-[0.65rem] text-ink-3">
                              {access.url}
                            </span>
                          </span>
                          <ExternalLink className="size-3.5 shrink-0 text-ink-3" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Observações fixas do cadastro */}
            {cert.notes && (
              <div className="mt-5">
                <p className="mb-1.5 text-xs font-medium text-ink-2">Observações</p>
                <p className="rounded-xl border border-line bg-panel-2 px-3.5 py-3 text-[0.82rem] leading-relaxed text-ink-2">
                  {cert.notes}
                </p>
              </div>
            )}
          </div>

          {/* Coluna do histórico */}
          <div className="flex min-h-0 flex-col border-t border-line bg-panel-2/30 lg:border-t-0 lg:border-l">
            <CertHistory key={cert.id} certId={cert.id} />
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
