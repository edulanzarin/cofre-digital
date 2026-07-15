// Conversões e validação das empresas (donas dos cofres).

import type { Company } from "./companies";

type CompanyRow = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  createdAt: Date;
  _count?: { certificates: number; accesses: number };
  certificates?: { expiresAt: Date }[];
};

// `certificates` vem ordenado pelo vencimento mais próximo (take: 1),
// que vira o "próximo vencimento" da listagem.
export function toCompanyDTO(row: CompanyRow): Company {
  return {
    id: row.id,
    cnpj: row.cnpj,
    razaoSocial: row.razaoSocial,
    createdAt: row.createdAt.toISOString(),
    certCount: row._count?.certificates ?? 0,
    accessCount: row._count?.accesses ?? 0,
    nextExpiresAt: row.certificates?.[0]?.expiresAt.toISOString() ?? null,
  };
}

export function parseCompanyBody(
  body: unknown,
): { cnpj: string; razaoSocial: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as { cnpj?: unknown; razaoSocial?: unknown };
  if (typeof b.cnpj !== "string" || typeof b.razaoSocial !== "string") return null;
  const cnpj = b.cnpj.replace(/\D/g, "");
  const razaoSocial = b.razaoSocial.trim();
  if (cnpj.length !== 14 || razaoSocial === "") return null;
  return { cnpj, razaoSocial };
}
