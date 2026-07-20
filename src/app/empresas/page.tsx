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
} from "lucide-react";
import type { Company } from "@/lib/companies";
import { useCompanies } from "@/lib/useCompanies";
import { useVaultConfig } from "@/lib/vaultConfig";
import {
  certStatus,
  formatDocument,
  STATUS_META,
  type CertStatus,
} from "@/lib/certificates";
import { useMe } from "@/lib/useMe";
import Modal from "@/components/ui/Modal";
import CompanyForm from "@/components/companies/CompanyForm";

// Situação da empresa = situação do certificado que vence primeiro.
function companyStatus(company: Company, alertDays: number): CertStatus | null {
  if (!company.nextExpiresAt) return null;
  return certStatus({ expiresAt: company.nextExpiresAt }, alertDays);
}

export default function CompaniesPage() {
  const { companies, ready, add } = useCompanies();
  const { alertDays } = useVaultConfig();
  const { can } = useMe();
  const canEdit = can("empresas", "edit");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return companies.filter(
      (c) =>
        !q ||
        c.razaoSocial.toLowerCase().includes(q) ||
        (digits.length > 0 && c.cnpj.includes(digits)),
    );
  }, [companies, query]);

  async function handleCreate(data: { cnpj: string; razaoSocial: string }) {
    await add(data);
    setCreating(false);
  }

  return (
    <div>
      {/* Cabeçalho */}
      <header className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p className="mt-1 text-sm text-ink-2">
            {ready
              ? `${companies.length} ${companies.length === 1 ? "empresa" : "empresas"} — cada uma com seu próprio cofre.`
              : "Abrindo o cofre…"}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setCreating(true)} className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Nova empresa
          </button>
        )}
      </header>

      {/* Busca */}
      <div className="anim-fade-up mb-5" style={{ animationDelay: "60ms" }}>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input
            className="vlt-input pl-9"
            placeholder="Buscar por razão social ou CNPJ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Lista */}
      {!ready ? (
        <ul className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="vlt-card h-16 animate-pulse bg-panel-2/40" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div
          className="vlt-card anim-fade-up flex flex-col items-center gap-3 px-6 py-16 text-center"
          style={{ animationDelay: "120ms" }}
        >
          <Inbox className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            {companies.length === 0
              ? "Nenhuma empresa cadastrada. Cadastre a primeira — ou guarde um e-CNPJ, que a empresa é criada sozinha."
              : "Nada encontrado com essa busca."}
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
                    <p className="mt-0.5 font-mono text-[0.7rem] text-ink-3">
                      {formatDocument(company.cnpj)}
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
          <CompanyForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
