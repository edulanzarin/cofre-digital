"use client";

import { FileKey2, CreditCard } from "lucide-react";
import {
  certStatus,
  daysLeft,
  formatDate,
  STATUS_META,
  type Certificate,
} from "@/lib/certificates";
import StatusBadge from "@/components/ui/StatusBadge";

// Lista (tabela) de certificados — formato pedido pela equipe, no lugar
// dos cartões. Clique na linha abre o drawer de detalhes.
export default function CertList({
  certs,
  alertDays,
  onSelect,
  showCompany = true,
  showGroup = false,
}: {
  certs: Certificate[];
  alertDays: number;
  onSelect: (id: string) => void;
  showCompany?: boolean;
  showGroup?: boolean;
}) {
  return (
    <div className="vlt-card overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[0.68rem] tracking-wide text-ink-3 uppercase">
            <th className="px-5 py-3 font-medium">Titular</th>
            <th className="px-4 py-3 font-medium">CNPJ / CPF</th>
            {showCompany && <th className="px-4 py-3 font-medium">Empresa</th>}
            {showGroup && (
              <th className="px-4 py-3 font-medium max-md:hidden">Grupo</th>
            )}
            <th className="px-4 py-3 font-medium">Vencimento</th>
            <th className="px-4 py-3 text-right font-medium">Dias</th>
            <th className="px-4 py-3 font-medium max-lg:hidden">Tipo</th>
            <th className="px-5 py-3 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {certs.map((cert) => {
            const d = daysLeft(cert);
            const status = certStatus(cert, alertDays);
            return (
              <tr
                key={cert.id}
                onClick={() => onSelect(cert.id)}
                className="cursor-pointer transition-colors hover:bg-panel-2/60"
              >
                <td className="max-w-64 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    {cert.media === "card" ? (
                      <CreditCard className="size-4 shrink-0 text-ink-3" strokeWidth={1.6} />
                    ) : (
                      <FileKey2 className="size-4 shrink-0 text-ink-3" strokeWidth={1.6} />
                    )}
                    <span className="truncate font-medium">{cert.holder}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[0.72rem] whitespace-nowrap text-ink-2">
                  {cert.document}
                </td>
                {showCompany && (
                  <td className="max-w-44 px-4 py-3">
                    <span className="block truncate text-xs text-ink-2">
                      {cert.company?.razaoSocial ?? "—"}
                    </span>
                  </td>
                )}
                {showGroup && (
                  <td className="max-w-40 px-4 py-3 max-md:hidden">
                    {cert.company?.group ? (
                      <span className="block truncate text-xs text-ink-2">
                        {cert.company.group.name}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-xs whitespace-nowrap text-ink-2">
                  {formatDate(cert.expiresAt)}
                </td>
                <td
                  className="px-4 py-3 text-right text-xs font-semibold tabular-nums"
                  style={{ color: STATUS_META[status].color }}
                >
                  {d}
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap text-ink-2 max-lg:hidden">
                  {cert.type}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge cert={cert} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
