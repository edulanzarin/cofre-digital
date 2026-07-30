"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Inbox, Network } from "lucide-react";
import type { CompanyInput } from "@/lib/useCompanies";
import { NO_GROUP } from "@/lib/companyGroups";
import { useCompanies } from "@/lib/useCompanies";
import { useCompanyGroups } from "@/lib/useCompanyGroups";
import { useVaultConfig } from "@/lib/vaultConfig";
import { useMe } from "@/lib/useMe";
import { useUrlState } from "@/lib/useUrlState";
import { toast, toastError } from "@/lib/toast";
import { SkeletonTable } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import Combobox from "@/components/ui/Combobox";
import CompanyForm from "@/components/companies/CompanyForm";
import CompanyList from "@/components/companies/CompanyList";

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
  const router = useRouter();
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
      toast.success("Grupo excluído.");
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
    toast.success("Empresa criada.");
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
        <SkeletonTable rows={6} cols={groups.length > 0 ? 6 : 5} />
      ) : filtered.length === 0 ? (
        <div
          className="vlt-card anim-fade-up flex flex-col items-center gap-3 px-6 py-16 text-center"
          style={{ animationDelay: "120ms" }}
        >
          <Inbox className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            {companies.length === 0
              ? "Nenhuma empresa cadastrada ainda."
              : group && !query.trim()
                ? "Nenhuma empresa neste grupo ainda."
                : "Nada encontrado com esses filtros."}
          </p>
        </div>
      ) : (
        <div className="anim-fade-up" style={{ animationDelay: "120ms" }}>
          <CompanyList
            companies={filtered}
            alertDays={alertDays}
            onSelect={(id) => router.push(`/empresas/${id}`)}
            showGroup={groups.length > 0}
          />
        </div>
      )}

      {/* Modal de cadastro */}
      {canEdit && creating && (
        <Modal title="Nova empresa" onClose={() => setCreating(false)}>
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
