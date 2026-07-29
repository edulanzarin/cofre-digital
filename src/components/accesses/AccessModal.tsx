"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Globe,
  ExternalLink,
  FileKey2,
  BookOpen,
  Building2,
  Maximize2,
} from "lucide-react";
import type { Access } from "@/lib/accesses";
import { useSettings } from "@/lib/settings";
import ExpiryRing from "@/components/ui/ExpiryRing";
import StatusBadge from "@/components/ui/StatusBadge";
import MarkdownView from "@/components/ui/MarkdownView";

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Detalhe do acesso em modal amplo, no mesmo molde do certificado: credenciais à
// esquerda, manual à direita (a coluna que no certificado é o histórico). O
// resumo vindo da lista já pinta o cabeçalho e as credenciais na hora; o texto
// do manual é buscado por id (a lista não o carrega, para não pesar).
export default function AccessModal({
  access,
  editor,
  onClose,
  onEdit,
  onDelete,
}: {
  access: Access;
  editor: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { confirmReveal } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [askingReveal, setAskingReveal] = useState(false);
  const [copied, setCopied] = useState<"login" | "password" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Manual (markdown) e demais campos que não vêm na listagem — buscados por id.
  const [tutorial, setTutorial] = useState<string | null>(null);
  const [tutorialReady, setTutorialReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Busca o detalhe por id só pelo manual (a lista traz login, cert e empresa).
  // O modal é remontado por acesso (key={id} no pai), então o estado já nasce
  // limpo — não precisa zerar aqui dentro do efeito.
  useEffect(() => {
    let active = true;
    fetch(`/api/accesses/${access.id}`)
      .then((r) => (r.ok ? (r.json() as Promise<Access>) : null))
      .then((data) => {
        if (!active) return;
        setTutorial(data?.tutorial?.trim() ? data.tutorial : null);
        setTutorialReady(true);
      })
      .catch(() => {
        if (active) setTutorialReady(true);
      });
    return () => {
      active = false;
    };
  }, [access.id]);

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

  async function fetchPassword(): Promise<string | null> {
    try {
      const res = await fetch(`/api/accesses/${access.id}/password`);
      if (!res.ok) return null;
      return ((await res.json()) as { password: string }).password;
    } catch {
      return null;
    }
  }

  // Revelar: só quem edita vê o botão; respeita "confirmar antes".
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

  async function copy(kind: "login" | "password") {
    const text =
      kind === "login" ? access.loginValue : (revealed ?? (await fetchPassword()));
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard bloqueado: sem feedback
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="vlt-card anim-pop flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden shadow-(--shadow-float)">
        {/* Cabeçalho */}
        <div className="flex items-start gap-4 border-b border-line px-6 py-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-info-soft text-info">
            <Globe className="size-6" strokeWidth={1.7} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1.05rem] leading-snug font-semibold tracking-tight">
              {access.name}
            </h2>
            <p className="mt-0.5 truncate font-mono text-xs text-ink-3">
              {hostOf(access.url)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="vlt-badge bg-panel-2 text-ink-2">
                {access.loginType}
              </span>
              {access.company && (
                <Link
                  href={`/empresas/${access.company.id}`}
                  onClick={onClose}
                  className="vlt-badge bg-brand-soft text-brand transition-opacity hover:opacity-80"
                  title="Abrir o cofre da empresa"
                >
                  <Building2 className="size-3" />
                  {access.company.razaoSocial}
                </Link>
              )}
            </div>
          </div>
          <button onClick={onClose} className="vlt-icon-btn -mr-2" title="Fechar">
            <X className="size-4" />
          </button>
        </div>

        {/* Corpo: credenciais | manual */}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_22rem]">
          {/* Coluna de credenciais */}
          <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
            {access.certificate ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-2">
                  Entrar com certificado digital
                </p>
                <div className="rounded-xl border border-line bg-panel-2 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <ExpiryRing cert={access.certificate} size={40} />
                      <FileKey2
                        className="absolute inset-0 m-auto size-3.5 text-ink-2"
                        strokeWidth={1.6}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {access.certificate.holder}
                      </p>
                      <p className="mt-0.5 text-[0.7rem] text-ink-3">
                        {access.certificate.type}
                      </p>
                      <div className="mt-1.5">
                        <StatusBadge cert={access.certificate} />
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/certificados?cert=${access.certificate.id}`}
                    className="vlt-btn vlt-btn-ghost mt-3 w-full !py-1.5 text-xs"
                  >
                    <FileKey2 className="size-3.5" />
                    Ver no cofre de certificados
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-2">
                  {access.loginType === "Outro" ? "Login" : access.loginType}
                </p>
                <div className="flex items-center gap-1 rounded-xl border border-line bg-panel-2 px-3 py-1.5">
                  <span className="flex-1 truncate font-mono text-sm">
                    {access.loginValue || "—"}
                  </span>
                  <button
                    onClick={() => copy("login")}
                    className="vlt-icon-btn"
                    title="Copiar login"
                  >
                    {copied === "login" ? (
                      <Check className="size-4 text-ok" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Senha */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-2">
                {access.certificate ? "Senha do certificado" : "Senha"}
              </p>
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
                      onClick={() => copy("password")}
                      className="vlt-icon-btn"
                      title="Copiar senha"
                    >
                      {copied === "password" ? (
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

            {/* Observações */}
            {access.notes && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-2">Observações</p>
                <p className="rounded-xl border border-line bg-panel-2 px-3.5 py-3 text-[0.82rem] leading-relaxed text-ink-2">
                  {access.notes}
                </p>
              </div>
            )}
          </div>

          {/* Coluna do manual */}
          <div className="flex min-h-0 flex-col border-t border-line bg-panel-2/30 lg:border-t-0 lg:border-l">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
              <BookOpen className="size-3.5 text-brand" />
              <p className="text-xs font-semibold tracking-tight">Manual de acesso</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!tutorialReady ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="vlt-skeleton h-4" />
                  ))}
                </div>
              ) : tutorial ? (
                <MarkdownView markdown={tutorial} />
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <BookOpen className="size-7 text-ink-3" strokeWidth={1.5} />
                  <p className="text-xs text-ink-3">Este acesso ainda não tem manual.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé de ações */}
        <div className="flex items-center justify-between gap-2 border-t border-line px-6 py-3.5">
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
              {editor ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="vlt-btn vlt-btn-danger !px-3"
                >
                  <Trash2 className="size-4" />
                  Excluir
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <Link
                  href={`/acessos/${access.id}`}
                  className="vlt-btn vlt-btn-ghost"
                  title="Abrir o manual em tela cheia"
                >
                  <Maximize2 className="size-4" />
                  Tela cheia
                </Link>
                <a
                  href={access.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="vlt-btn vlt-btn-ghost"
                >
                  <ExternalLink className="size-4" />
                  Abrir o site
                </a>
                {editor && (
                  <button onClick={onEdit} className="vlt-btn vlt-btn-primary">
                    <Pencil className="size-4" />
                    Editar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
