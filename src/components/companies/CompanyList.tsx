"use client";

import { Building2, ShieldCheck, Globe, FileBadge } from "lucide-react";
import {
  certStatus,
  formatDate,
  formatDocument,
  STATUS_META,
  type CertStatus,
} from "@/lib/certificates";
import type { Company } from "@/lib/companies";

// Situação da empresa = a do certificado que vence primeiro (null se não há cert).
function companyStatus(company: Company, alertDays: number): CertStatus | null {
  if (!company.nextExpiresAt) return null;
  return certStatus({ expiresAt: company.nextExpiresAt }, alertDays);
}

// Lista (tabela) de empresas — mesmo formato dos certificados: cabe mais e mostra
// o cofre (certificados/acessos/alvarás), o grupo e a situação de relance. A linha
// abre o cofre da empresa (/empresas/[id]).
export default function CompanyList({
  companies,
  alertDays,
  onSelect,
  showGroup = true,
}: {
  companies: Company[];
  alertDays: number;
  onSelect: (id: string) => void;
  showGroup?: boolean;
}) {
  return (
    <div className="vlt-card max-h-full overflow-auto">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-line bg-panel text-[0.68rem] tracking-wide text-ink-3 uppercase">
            <th className="px-5 py-3 font-medium">Razão social</th>
            <th className="px-4 py-3 font-medium">CNPJ</th>
            {showGroup && (
              <th className="px-4 py-3 font-medium max-md:hidden">Grupo</th>
            )}
            <th className="px-4 py-3 font-medium max-sm:hidden">Cofre</th>
            <th className="px-4 py-3 font-medium max-lg:hidden">Próx. vencimento</th>
            <th className="px-5 py-3 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {companies.map((company) => {
            const status = companyStatus(company, alertDays);
            return (
              <tr
                key={company.id}
                onClick={() => onSelect(company.id)}
                className="cursor-pointer transition-colors hover:bg-panel-2/60"
              >
                <td className="max-w-72 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Building2 className="size-4" strokeWidth={1.8} />
                    </span>
                    <span className="truncate font-medium">{company.razaoSocial}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[0.72rem] whitespace-nowrap text-ink-2">
                  {formatDocument(company.cnpj)}
                </td>
                {showGroup && (
                  <td className="max-w-40 px-4 py-3 max-md:hidden">
                    {company.group ? (
                      <span className="block truncate text-xs text-ink-2">
                        {company.group.name}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 max-sm:hidden">
                  <div className="flex items-center gap-3 text-[0.72rem] text-ink-3">
                    <span className="flex items-center gap-1" title="Certificados">
                      <ShieldCheck className="size-3.5" />
                      {company.certCount}
                    </span>
                    <span className="flex items-center gap-1" title="Acessos">
                      <Globe className="size-3.5" />
                      {company.accessCount}
                    </span>
                    <span className="flex items-center gap-1" title="Alvarás">
                      <FileBadge className="size-3.5" />
                      {company.alvaraCount}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap text-ink-2 max-lg:hidden">
                  {company.nextExpiresAt ? formatDate(company.nextExpiresAt) : "—"}
                </td>
                <td className="px-5 py-3">
                  {status ? (
                    <span
                      className="vlt-badge"
                      style={{
                        background: STATUS_META[status].soft,
                        color: STATUS_META[status].color,
                      }}
                    >
                      {STATUS_META[status].label}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-3">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
