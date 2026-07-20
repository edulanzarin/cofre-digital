// Conversões e validação das empresas (donas dos cofres).

import type { Company } from "./companies";

// Tudo que o DTO da empresa precisa — contagens do cofre, o certificado
// que vence primeiro e o grupo econômico.
export const COMPANY_INCLUDE = {
  _count: { select: { certificates: true, accesses: true, alvaras: true } },
  certificates: {
    select: { expiresAt: true },
    orderBy: { expiresAt: "asc" },
    take: 1,
  },
  group: { select: { id: true, name: true } },
} as const;

type CompanyRow = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  groupId: string | null;
  group?: { id: string; name: string } | null;
  createdAt: Date;
  _count?: { certificates: number; accesses: number; alvaras: number };
  certificates?: { expiresAt: Date }[];
};

// `certificates` vem ordenado pelo vencimento mais próximo (take: 1),
// que vira o "próximo vencimento" da listagem.
export function toCompanyDTO(row: CompanyRow): Company {
  return {
    id: row.id,
    cnpj: row.cnpj,
    razaoSocial: row.razaoSocial,
    groupId: row.groupId,
    group: row.group ?? null,
    createdAt: row.createdAt.toISOString(),
    certCount: row._count?.certificates ?? 0,
    accessCount: row._count?.accesses ?? 0,
    alvaraCount: row._count?.alvaras ?? 0,
    nextExpiresAt: row.certificates?.[0]?.expiresAt.toISOString() ?? null,
  };
}

// `groupId` ausente ou vazio = empresa sem grupo. O vínculo é opcional:
// grupo é conveniência de filtro, não obrigação de cadastro.
export function parseCompanyBody(
  body: unknown,
): { cnpj: string; razaoSocial: string; groupId: string | null } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as { cnpj?: unknown; razaoSocial?: unknown; groupId?: unknown };
  if (typeof b.cnpj !== "string" || typeof b.razaoSocial !== "string") return null;
  const cnpj = b.cnpj.replace(/\D/g, "");
  const razaoSocial = b.razaoSocial.trim();
  if (cnpj.length !== 14 || razaoSocial === "") return null;
  const groupId = typeof b.groupId === "string" && b.groupId !== "" ? b.groupId : null;
  return { cnpj, razaoSocial, groupId };
}
