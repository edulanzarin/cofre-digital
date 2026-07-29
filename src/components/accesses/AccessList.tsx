"use client";

import { Globe, FileKey2, BookOpen } from "lucide-react";
import type { Access } from "@/lib/accesses";

// Host legível do site (sem www.), com fallback pra url crua se não parsear.
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Lista (tabela) de acessos — mesmo formato dos certificados, no lugar dos
// cards: cabe mais, mostra tipo de login e credencial de relance, e a linha
// abre o modal de detalhe. Clique na linha seleciona.
export default function AccessList({
  accesses,
  onSelect,
  showCompany = false,
}: {
  accesses: Access[];
  onSelect: (id: string) => void;
  showCompany?: boolean;
}) {
  return (
    <div className="vlt-card overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[0.68rem] tracking-wide text-ink-3 uppercase">
            <th className="px-5 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Site</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Login</th>
            {showCompany && (
              <th className="px-4 py-3 font-medium max-md:hidden">Empresa</th>
            )}
            <th className="px-5 py-3 font-medium">Manual</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {accesses.map((access) => (
            <tr
              key={access.id}
              onClick={() => onSelect(access.id)}
              className="cursor-pointer transition-colors hover:bg-panel-2/60"
            >
              <td className="max-w-64 px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <Globe className="size-4 shrink-0 text-ink-3" strokeWidth={1.6} />
                  <span className="truncate font-medium">{access.name}</span>
                </div>
              </td>
              <td className="max-w-48 px-4 py-3">
                <span className="block truncate font-mono text-[0.72rem] text-ink-2">
                  {hostOf(access.url)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="vlt-badge bg-panel-2 !text-[0.65rem] text-ink-2">
                  {access.loginType}
                </span>
              </td>
              <td className="max-w-48 px-4 py-3">
                {access.certificate ? (
                  <span className="flex items-center gap-1.5 text-xs text-ink-2">
                    <FileKey2
                      className="size-3.5 shrink-0 text-ink-3"
                      strokeWidth={1.6}
                    />
                    <span className="truncate">{access.certificate.holder}</span>
                  </span>
                ) : (
                  <span className="block truncate font-mono text-[0.72rem] text-ink-2">
                    {access.loginValue || "—"}
                  </span>
                )}
              </td>
              {showCompany && (
                <td className="max-w-40 px-4 py-3 max-md:hidden">
                  <span className="block truncate text-xs text-ink-2">
                    {access.company?.razaoSocial ?? "—"}
                  </span>
                </td>
              )}
              <td className="px-5 py-3">
                {access.hasTutorial ? (
                  <span className="flex items-center gap-1 text-xs text-brand">
                    <BookOpen className="size-3.5" />
                    Sim
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
