"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  Globe,
  BookOpen,
  Inbox,
  FileBadge,
} from "lucide-react";
import type { Company } from "@/lib/companies";
import { formatDocument, type Certificate } from "@/lib/certificates";
import type { Access } from "@/lib/accesses";
import { useCertificates } from "@/lib/useCertificates";
import { useAccesses } from "@/lib/useAccesses";
import { useVaultConfig } from "@/lib/vaultConfig";
import { useMe } from "@/lib/useMe";
import Modal from "@/components/ui/Modal";
import CertList from "@/components/certificates/CertList";
import CertForm from "@/components/certificates/CertForm";
import CertModal from "@/components/certificates/CertModal";
import AccessForm from "@/components/accesses/AccessForm";
import CompanyForm from "@/components/companies/CompanyForm";

type Tab = "certificados" | "acessos";

// O cofre da empresa: tudo que é dela num lugar só. Novos módulos
// (alvarás etc.) entram como novas abas.
export default function CompanyVaultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useMe();
  const { alertDays } = useVaultConfig();

  const [company, setCompany] = useState<Company | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("certificados");
  const [editingCompany, setEditingCompany] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/companies/${id}`)
      .then((r) => (r.ok ? (r.json() as Promise<Company>) : null))
      .then((data) => {
        if (data) setCompany(data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(load, [load]);

  async function handleUpdate(data: { cnpj: string; razaoSocial: string }) {
    const res = await fetch(`/api/companies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Falha ao salvar.");
    }
    setCompany((await res.json()) as Company);
    setEditingCompany(false);
  }

  async function handleDelete() {
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Falha ao excluir a empresa.");
      return;
    }
    router.push("/empresas");
  }

  if (notFound) {
    return (
      <div className="vlt-card mx-auto mt-20 max-w-md px-6 py-12 text-center">
        <Inbox className="mx-auto size-8 text-ink-3" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-ink-2">Empresa não encontrada.</p>
        <Link href="/empresas" className="vlt-btn vlt-btn-ghost mt-4">
          <ArrowLeft className="size-4" />
          Voltar para empresas
        </Link>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-panel-2/60" />
        <div className="vlt-card h-24 animate-pulse bg-panel-2/40" />
        <div className="vlt-card h-64 animate-pulse bg-panel-2/40" />
      </div>
    );
  }

  return (
    <div>
      {/* Voltar */}
      <Link
        href="/empresas"
        className="anim-fade-up mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Empresas
      </Link>

      {/* Cabeçalho */}
      <header className="anim-fade-up mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <Building2 className="size-6" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {company.razaoSocial}
            </h1>
            <p className="truncate font-mono text-xs text-ink-3">
              {formatDocument(company.cnpj)}
            </p>
          </div>
        </div>
        {can("empresas", "edit") && (
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs text-ink-2">
                  Excluir? Os itens ficam no cofre geral, sem vínculo.
                </span>
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
                  title="Excluir empresa"
                >
                  <Trash2 className="size-4" />
                </button>
                <button
                  onClick={() => setEditingCompany(true)}
                  className="vlt-btn vlt-btn-ghost"
                >
                  <Pencil className="size-4" />
                  Editar
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {/* Abas do cofre */}
      <div className="anim-fade-up mb-5 flex flex-wrap items-center gap-3" style={{ animationDelay: "60ms" }}>
        <div className="vlt-segment">
          {can("certificados") && (
            <button data-active={tab === "certificados"} onClick={() => setTab("certificados")}>
              <ShieldCheck className="size-3.5" />
              Certificados
            </button>
          )}
          {can("acessos") && (
            <button data-active={tab === "acessos"} onClick={() => setTab("acessos")}>
              <Globe className="size-3.5" />
              Acessos
            </button>
          )}
          <button disabled title="Em breve" className="!cursor-default opacity-40">
            <FileBadge className="size-3.5" />
            Alvarás · em breve
          </button>
        </div>
      </div>

      {tab === "certificados" && can("certificados") && (
        <CompanyCerts companyId={company.id} companyName={company.razaoSocial} alertDays={alertDays} />
      )}
      {tab === "acessos" && can("acessos") && (
        <CompanyAccesses companyId={company.id} />
      )}

      {/* Modal de edição da empresa */}
      {editingCompany && (
        <Modal
          title="Editar empresa"
          subtitle={company.razaoSocial}
          onClose={() => setEditingCompany(false)}
        >
          <CompanyForm
            initial={company}
            onSubmit={handleUpdate}
            onCancel={() => setEditingCompany(false)}
          />
        </Modal>
      )}
    </div>
  );
}

// --- Aba de certificados da empresa ---

function CompanyCerts({
  companyId,
  companyName,
  alertDays,
}: {
  companyId: string;
  companyName: string;
  alertDays: number;
}) {
  const { certs, ready, add, update, remove } = useCertificates(companyId);
  const { can } = useMe();
  const canEdit = can("certificados", "edit");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"closed" | "new" | "edit">("closed");
  const [editCert, setEditCert] = useState<Certificate | null>(null);

  const selected = certs.find((c) => c.id === selectedId) ?? null;

  async function handleSubmit(data: Omit<Certificate, "id">) {
    try {
      if (modal === "edit" && selected) {
        await update(selected.id, data);
      } else {
        await add(data);
      }
      setModal("closed");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao salvar.");
    }
  }

  async function openEdit() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/certificates/${selected.id}`);
      if (!res.ok) throw new Error("Sem permissão para editar.");
      setEditCert((await res.json()) as Certificate);
      setModal("edit");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao abrir edição.");
    }
  }

  return (
    <div className="anim-fade-up" style={{ animationDelay: "100ms" }}>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setModal("new")} className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Novo certificado
          </button>
        </div>
      )}

      {!ready ? (
        <div className="vlt-card h-48 animate-pulse bg-panel-2/40" />
      ) : certs.length === 0 ? (
        <div className="vlt-card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <ShieldCheck className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            Nenhum certificado no cofre desta empresa.
          </p>
        </div>
      ) : (
        <CertList
          certs={certs}
          alertDays={alertDays}
          onSelect={setSelectedId}
          showCompany={false}
        />
      )}

      {selected && modal === "closed" && (
        <CertModal
          cert={selected}
          editor={canEdit}
          onClose={() => setSelectedId(null)}
          onEdit={openEdit}
          onDelete={async () => {
            try {
              await remove(selected.id);
              setSelectedId(null);
            } catch (err) {
              alert(err instanceof Error ? err.message : "Falha ao excluir.");
            }
          }}
        />
      )}

      {canEdit && modal !== "closed" && (
        <Modal
          title={modal === "edit" ? "Editar certificado" : "Novo certificado"}
          subtitle={modal === "edit" ? editCert?.holder : "Entra direto no cofre desta empresa."}
          onClose={() => setModal("closed")}
        >
          <CertForm
            initial={modal === "edit" ? (editCert ?? undefined) : undefined}
            fixedCompanyId={companyId}
            fixedCompanyName={companyName}
            onSubmit={handleSubmit}
            onCancel={() => setModal("closed")}
          />
        </Modal>
      )}
    </div>
  );
}

// --- Aba de acessos da empresa ---

function CompanyAccesses({ companyId }: { companyId: string }) {
  const { accesses, ready, add } = useAccesses(companyId);
  const { can } = useMe();
  const canEdit = can("acessos", "edit");
  const [creating, setCreating] = useState(false);

  async function handleCreate(data: Omit<Access, "id">) {
    try {
      await add(data);
      setCreating(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao salvar.");
    }
  }

  return (
    <div className="anim-fade-up" style={{ animationDelay: "100ms" }}>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setCreating(true)} className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Novo acesso
          </button>
        </div>
      )}

      {!ready ? (
        <div className="vlt-card h-40 animate-pulse bg-panel-2/40" />
      ) : accesses.length === 0 ? (
        <div className="vlt-card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Globe className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">Nenhum acesso no cofre desta empresa.</p>
        </div>
      ) : (
        <ul className="vlt-card divide-y divide-line">
          {accesses.map((access) => (
            <li key={access.id}>
              <Link
                href={`/acessos/${access.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-panel-2/60"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
                  <Globe className="size-4" strokeWidth={1.7} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{access.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[0.7rem] text-ink-3">
                    {access.url}
                  </p>
                </div>
                <span className="vlt-badge shrink-0 bg-panel-2 !text-[0.65rem] text-ink-2">
                  {access.loginType}
                </span>
                {access.hasTutorial && (
                  <span className="flex shrink-0 items-center gap-1 text-[0.72rem] text-brand">
                    <BookOpen className="size-3.5" />
                    Manual
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canEdit && creating && (
        <Modal
          wide
          title="Novo acesso"
          subtitle="Entra direto no cofre desta empresa."
          onClose={() => setCreating(false)}
        >
          <AccessForm
            fixedCompanyId={companyId}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}
    </div>
  );
}
