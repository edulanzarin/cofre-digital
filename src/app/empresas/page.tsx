"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Building2,
  Inbox,
  ShieldCheck,
  Globe,
  FileBadge,
  ChevronRight,
  Network,
} from "lucide-react";
import type { Company } from "@/lib/companies";
import type { CompanyInput } from "@/lib/useCompanies";
import { NO_GROUP } from "@/lib/companyGroups";
import { useCompanies } from "@/lib/useCompanies";
import { useCompanyGroups } from "@/lib/useCompanyGroups";
import { useVaultConfig } from "@/lib/vaultConfig";
import {
  certStatus,
  formatDocument,
  STATUS_META,
  type CertStatus,
} from "@/lib/certificates";
import { useMe } from "@/lib/useMe";
import { useUrlState } from "@/lib/useUrlState";
import { toast, toastError } from "@/lib/toast";
import { SkeletonCards } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import Combobox from "@/components/ui/Combobox";
import CompanyForm from "@/components/companies/CompanyForm";

// Situação da empresa = situação do certificado que vence primeiro.
function companyStatus(company: Company, alertDays: number): CertStatus | null {
  if (!company.nextExpiresAt) return null;
  return certStatus({ expiresAt: company.nextExpiresAt }, alertDays);
}

export default function CompaniesPage() {
  const { companies, ready, add, refresh: refreshCompanies } = useCompanies();
  const {
    groups,
    refresh: refreshGroups,
    add: addGroup,
    rename: renameGroup,
    remove: removeGroup,
  } = useCompanyGroups();
  const { alertDays } = useVaultConfig();
  const { can } = useMe();
  const canEdit = can("empresas", "edit");
  // Busca e grupo na URL: link compartilhável e reload sem perder o contexto.
  const [query, setQuery] = useUrlState("q", "");
  const [group, setGroup] = useUrlState("grupo", "");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return companies
      .filter((c) =>
        !group ? true : group === NO_GROUP ? !c.groupId : c.groupId === group,
      )
      .filter(
        (c) =>
          !q ||
          c.razaoSocial.toLowerCase().includes(q) ||
          (digits.length > 0 && c.cnpj.includes(digits)),
      );
  }, [companies, query, group]);

  const ungrouped = useMemo(
    () => companies.filter((c) => !c.groupId).length,
    [companies],
  );

  const groupOptions = useMemo(
    () => [
      { value: "", label: "Todos os grupos", hint: String(companies.length) },
      ...groups.map((g) => ({
        value: g.id,
        label: g.name,
        hint: String(g.companyCount),
        manageable: true,
      })),
      ...(ungrouped > 0
        ? [{ value: NO_GROUP, label: "Sem grupo", hint: String(ungrouped) }]
        : []),
    ],
    [groups, companies.length, ungrouped],
  );

  // Grupo criado na hora, de dentro do cadastro da empresa — devolve o id
  // para o formulário já vinculá-lo.
  async function handleCreateGroup(name: string) {
    const created = await addGroup(name);
    return created.id;
  }

  // Renomear/excluir grupo vivem no próprio filtro. Como o nome do grupo
  // aparece embutido em cada empresa, recarrega a lista para refletir.
  async function handleRenameGroup(id: string, name: string) {
    try {
      await renameGroup(id, name);
      await refreshCompanies();
    } catch (err) {
      toastError(err, "Falha ao renomear o grupo.");
    }
  }

  async function handleDeleteGroup(id: string) {
    try {
      await removeGroup(id);
      await refreshCompanies();
      toast.success("Grupo excluído — as empresas ficaram sem grupo.");
    } catch (err) {
      toastError(err, "Falha ao excluir o grupo.");
    }
  }

  async function handleCreate(data: CompanyInput) {
    // O erro sobe para o CompanyForm, que já o mostra ao lado dos campos —
    // um toast aqui repetiria a mesma mensagem em dois lugares.
    await add(data);
    if (data.groupId) await refreshGroups(); // a contagem do grupo mudou
    setCreating(false);
    toast.success("Empresa criada — o cofre dela já está disponível.");
  }

  return (
    <div>
      {/* Cabeçalho */}
      <header className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
        {canEdit && (
          <button onClick={() => setCreating(true)} className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Nova empresa
          </button>
        )}
      </header>

      {/* Busca + grupo. O grupo nasce e é gerenciado de dentro do cadastro da
          empresa e deste próprio filtro — não há mais tela separada. */}
      <div
        className="anim-fade-up mb-5 flex flex-wrap items-center gap-3"
        style={{ animationDelay: "60ms" }}
      >
        <div className="relative min-w-56 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input
            className="vlt-input pl-9"
            placeholder="Buscar por razão social ou CNPJ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {groups.length > 0 && (
          <Combobox
            className="w-56"
            options={groupOptions}
            value={group}
            onChange={setGroup}
            searchPlaceholder="Buscar grupo…"
            onRename={canEdit ? handleRenameGroup : undefined}
            onDelete={canEdit ? handleDeleteGroup : undefined}
            icon={<Network className="size-4 shrink-0 text-ink-3" />}
          />
        )}
      </div>

      {/* Lista */}
      {!ready ? (
        <SkeletonCards rows={5} className="h-16" />
      ) : filtered.length === 0 ? (
        <div
          className="vlt-card anim-fade-up flex flex-col items-center gap-3 px-6 py-16 text-center"
          style={{ animationDelay: "120ms" }}
        >
          <Inbox className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            {companies.length === 0
              ? "Nenhuma empresa cadastrada. Cadastre a primeira — ou guarde um e-CNPJ, que a empresa é criada sozinha."
              : group && !query.trim()
                ? "Nenhuma empresa neste grupo ainda."
                : "Nada encontrado com esses filtros."}
          </p>
        </div>
      ) : (
        <ul
          className="vlt-card anim-fade-up divide-y divide-line"
          style={{ animationDelay: "120ms" }}
        >
          {filtered.map((company) => {
            const status = companyStatus(company, alertDays);
            return (
              <li key={company.id}>
                <Link
                  href={`/empresas/${company.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-panel-2/60"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Building2 className="size-4" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {company.razaoSocial}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[0.7rem] text-ink-3">
                      <span className="font-mono">
                        {formatDocument(company.cnpj)}
                      </span>
                      {company.group && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{company.group.name}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-[0.72rem] text-ink-3 max-sm:hidden">
                    <span className="flex items-center gap-1.5" title="Certificados">
                      <ShieldCheck className="size-3.5" />
                      {company.certCount}
                    </span>
                    <span className="flex items-center gap-1.5" title="Acessos">
                      <Globe className="size-3.5" />
                      {company.accessCount}
                    </span>
                    <span className="flex items-center gap-1.5" title="Alvarás">
                      <FileBadge className="size-3.5" />
                      {company.alvaraCount}
                    </span>
                  </div>
                  {status && (
                    <span
                      className="vlt-badge shrink-0"
                      style={{
                        background: STATUS_META[status].soft,
                        color: STATUS_META[status].color,
                      }}
                    >
                      {STATUS_META[status].label}
                    </span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-ink-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal de cadastro */}
      {canEdit && creating && (
        <Modal
          title="Nova empresa"
          subtitle="Razão social e CNPJ — o cofre dela nasce junto."
          onClose={() => setCreating(false)}
        >
          <CompanyForm
            groups={groups}
            onCreateGroup={handleCreateGroup}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}
    </div>
  );
}
