"use client";

import { FileBadge, Paperclip } from "lucide-react";
import {
  alvaraDaysLeft,
  alvaraStatus,
  ALVARA_STATUS_META,
  type Alvara,
} from "@/lib/alvaras";
import { formatDate } from "@/lib/certificates";
import AlvaraBadge from "@/components/alvaras/AlvaraBadge";

// Lista (tabela) de alvarás, no mesmo formato da de certificados.
// Clique na linha abre o modal de detalhes.
export default function AlvaraList({
  alvaras,
  alertDays,
  onSelect,
  showCompany = true,
}: {
  alvaras: Alvara[];
  alertDays: number;
  onSelect: (id: string) => void;
  showCompany?: boolean;
}) {
  return (
    <div className="vlt-card overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[0.68rem] tracking-wide text-ink-3 uppercase">
            <th className="px-5 py-3 font-medium">Alvará</th>
            {showCompany && <th className="px-4 py-3 font-medium">Empresa</th>}
            <th className="px-4 py-3 font-medium">Órgão emissor</th>
            <th className="px-4 py-3 font-medium">Vencimento</th>
            <th className="px-4 py-3 text-right font-medium">Dias</th>
            <th className="px-5 py-3 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {alvaras.map((alvara) => {
            const status = alvaraStatus(alvara, alertDays);
            const d = alvaraDaysLeft(alvara);
            return (
              <tr
                key={alvara.id}
                onClick={() => onSelect(alvara.id)}
                className="cursor-pointer transition-colors hover:bg-panel-2/60"
              >
                <td className="max-w-64 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <FileBadge className="size-4 shrink-0 text-ink-3" strokeWidth={1.6} />
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate font-medium">
                        {alvara.name}
                        {alvara.hasFile && (
                          <Paperclip
                            className="size-3 shrink-0 text-ink-3"
                            aria-label="PDF anexado"
                          />
                        )}
                      </span>
                      {alvara.number && (
                        <span className="block truncate font-mono text-[0.68rem] text-ink-3">
                          Nº {alvara.number}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                {showCompany && (
                  <td className="max-w-44 px-4 py-3">
                    <span className="block truncate text-xs text-ink-2">
                      {alvara.company?.razaoSocial ?? "—"}
                    </span>
                  </td>
                )}
                <td className="max-w-40 px-4 py-3">
                  <span className="block truncate text-xs text-ink-2">
                    {alvara.issuer ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap text-ink-2">
                  {alvara.expiresAt ? formatDate(alvara.expiresAt) : "—"}
                </td>
                <td
                  className="px-4 py-3 text-right text-xs font-semibold tabular-nums"
                  style={{ color: ALVARA_STATUS_META[status].color }}
                >
                  {alvara.expiresAt ? d : "—"}
                </td>
                <td className="px-5 py-3">
                  <AlvaraBadge alvara={alvara} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
