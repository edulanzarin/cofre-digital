"use client";

import { useState } from "react";
import {
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
} from "lucide-react";
import {
  certStatus,
  daysLeft,
  formatDate,
  STATUS_META,
  type Certificate,
} from "@/lib/certificates";
import { useSettings } from "@/lib/settings";
import { useVaultConfig } from "@/lib/vaultConfig";
import Drawer from "@/components/ui/Drawer";
import ExpiryRing from "@/components/ui/ExpiryRing";
import StatusBadge from "@/components/ui/StatusBadge";

export default function CertDrawer({
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
  const [revealed, setRevealed] = useState<string | null>(null);
  const [askingReveal, setAskingReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  // Revelar: só o Societário vê esse botão; respeita "confirmar antes".
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

  // Copiar: todos os setores podem, sem exibir a senha.
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

  return (
    <Drawer
      title="Detalhes do certificado"
      onClose={onClose}
      footer={
        editor ? (
          <div className="flex items-center justify-between gap-2">
            {confirmDelete ? (
              <>
                <p className="text-xs text-ink-2">Excluir do cofre?</p>
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
        ) : undefined
      }
    >
      {/* Identidade */}
      <div className="flex items-start gap-4">
        <div className="relative">
          <ExpiryRing cert={cert} size={56} />
          {isCard ? (
            <CreditCard
              className="absolute inset-0 m-auto size-5 text-ink-2"
              strokeWidth={1.6}
            />
          ) : (
            <FileKey2
              className="absolute inset-0 m-auto size-5 text-ink-2"
              strokeWidth={1.6}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.95rem] leading-snug font-semibold tracking-tight">
            {cert.holder}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-ink-3">{cert.document}</p>
          <div className="mt-2">
            <StatusBadge cert={cert} />
          </div>
        </div>
      </div>

      {/* Prazo */}
      <div
        className="mt-5 flex items-center gap-3 rounded-xl border border-line px-4 py-3"
        style={{ background: STATUS_META[status].soft }}
      >
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

      {/* Campos */}
      <dl className="mt-5 space-y-4">
        <Row label="Tipo" value={cert.type} />
        <Row label="Mídia" value={isCard ? "Cartão / token físico" : "Arquivo digital"} />
        <Row label="Autoridade certificadora" value={cert.issuer} />
        <Row label="Emitido em" value={formatDate(cert.issuedAt)} />
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
            Seu setor pode copiar a senha, mas não visualizá-la.
          </p>
        )}
      </div>

      {/* Observações */}
      {cert.notes && (
        <div className="mt-5">
          <p className="mb-1.5 text-xs font-medium text-ink-2">Observações</p>
          <p className="rounded-xl border border-line bg-panel-2 px-3.5 py-3 text-[0.82rem] leading-relaxed text-ink-2">
            {cert.notes}
          </p>
        </div>
      )}
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-ink-3">{label}</dt>
      <dd className="truncate text-sm">{value}</dd>
    </div>
  );
}
