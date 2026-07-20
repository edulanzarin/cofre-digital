"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  BookOpen,
  Inbox,
  FileKey2,
} from "lucide-react";
import ExpiryRing from "@/components/ui/ExpiryRing";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Access } from "@/lib/accesses";
import { useSettings } from "@/lib/settings";
import { useMe } from "@/lib/useMe";
import { toast } from "@/lib/toast";
import Modal from "@/components/ui/Modal";
import MarkdownView from "@/components/ui/MarkdownView";
import AccessForm from "@/components/accesses/AccessForm";

export default function AccessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useMe();
  const editor = can("acessos", "edit");
  const { confirmReveal } = useSettings();

  const [access, setAccess] = useState<Access | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [askingReveal, setAskingReveal] = useState(false);
  const [copied, setCopied] = useState<"login" | "password" | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/accesses/${id}`)
      .then((r) => (r.ok ? (r.json() as Promise<Access>) : null))
      .then((data) => {
        if (data) setAccess(data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(load, [load]);

  async function fetchPassword(): Promise<string | null> {
    try {
      const res = await fetch(`/api/accesses/${id}/password`);
      if (!res.ok) return null;
      return ((await res.json()) as { password: string }).password;
    } catch {
      return null;
    }
  }

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
      kind === "login"
        ? (access?.loginValue ?? "")
        : (revealed ?? (await fetchPassword()));
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard bloqueado
    }
  }

  async function handleUpdate(data: Omit<Access, "id">) {
    const res = await fetch(`/api/accesses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Falha ao salvar as alterações.");
      return;
    }
    setAccess((await res.json()) as Access);
    setEditing(false);
    toast.success("Acesso atualizado.");
  }

  async function handleDelete() {
    const res = await fetch(`/api/accesses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir.");
      return;
    }
    toast.success("Acesso excluído do cofre.");
    router.push("/acessos");
  }

  if (notFound) {
    return (
      <div className="vlt-card mx-auto mt-20 max-w-md px-6 py-12 text-center">
        <Inbox className="mx-auto size-8 text-ink-3" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-ink-2">Acesso não encontrado.</p>
        <Link href="/acessos" className="vlt-btn vlt-btn-ghost mt-4">
          <ArrowLeft className="size-4" />
          Voltar para acessos
        </Link>
      </div>
    );
  }

  if (!access) {
    return (
      <div className="space-y-6">
        <div className="vlt-skeleton h-8 w-40" />
        <div className="vlt-skeleton h-24" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="vlt-skeleton h-64" />
          <div className="vlt-skeleton h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  let host = access.url;
  try {
    host = new URL(access.url).host;
  } catch {
    // url fora do padrão
  }

  return (
    <div>
      {/* Voltar */}
      <Link
        href="/acessos"
        className="anim-fade-up mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Acessos
      </Link>

      {/* Cabeçalho */}
      <header className="anim-fade-up mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-info-soft text-info">
            <Globe className="size-6" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {access.name}
            </h1>
            <p className="truncate font-mono text-xs text-ink-3">{host}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editor &&
            (confirmDelete ? (
              <>
                <span className="text-xs text-ink-2">Excluir do cofre?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="vlt-btn vlt-btn-danger !px-3 !py-1.5 text-xs"
                >
                  Excluir
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="vlt-icon-btn hover:!bg-bad-soft hover:!text-bad"
                  title="Excluir"
                >
                  <Trash2 className="size-4" />
                </button>
                <button onClick={() => setEditing(true)} className="vlt-btn vlt-btn-ghost">
                  <Pencil className="size-4" />
                  Editar
                </button>
              </>
            ))}
          <a
            href={access.url}
            target="_blank"
            rel="noreferrer noopener"
            className="vlt-btn vlt-btn-primary"
          >
            <ExternalLink className="size-4" />
            Abrir o site
          </a>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Credenciais */}
        <section
          className="vlt-card anim-fade-up lg:sticky lg:top-8"
          style={{ animationDelay: "60ms" }}
        >
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold tracking-tight">Credenciais</h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            {access.certificate ? (
              // Login por certificado digital: mostra o certificado do cofre.
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
                    {access.loginValue}
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

            {access.notes && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-2">Observações</p>
                <p className="rounded-xl border border-line bg-panel-2 px-3.5 py-3 text-[0.82rem] leading-relaxed text-ink-2">
                  {access.notes}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Manual de acesso */}
        <section
          className="vlt-card anim-fade-up lg:col-span-2"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-center gap-2 border-b border-line px-6 py-3.5">
            <BookOpen className="size-4 text-brand" />
            <h2 className="text-sm font-semibold tracking-tight">Manual de acesso</h2>
          </div>
          {access.tutorial?.trim() ? (
            <div className="px-6 py-5 [&_.md-body]:text-[0.9rem]">
              <MarkdownView markdown={access.tutorial} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <BookOpen className="size-8 text-ink-3" strokeWidth={1.5} />
              <p className="text-sm text-ink-2">
                Este acesso ainda não tem manual.
              </p>
              {editor && (
                <button
                  onClick={() => setEditing(true)}
                  className="vlt-btn vlt-btn-ghost"
                >
                  <Pencil className="size-4" />
                  Escrever o manual
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Modal de edição */}
      {editor && editing && (
        <Modal
          wide
          title="Editar acesso"
          subtitle={access.name}
          onClose={() => setEditing(false)}
        >
          <AccessForm
            initial={access}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}
    </div>
  );
}
