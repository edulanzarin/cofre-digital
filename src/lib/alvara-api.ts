// Conversões entre o modelo do banco e o DTO usado pelo front,
// mais a validação do corpo das requisições de alvará.

import type { Alvara as AlvaraRow } from "@/generated/prisma/client";
import type { Alvara } from "./alvaras";

// Sempre buscar alvarás com este include: o front mostra a empresa dona.
export const ALVARA_INCLUDE = {
  company: { select: { id: true, razaoSocial: true, cnpj: true } },
} as const;

type AlvaraRowFull = AlvaraRow & {
  company: { id: string; razaoSocial: string; cnpj: string } | null;
};

// `withFile` só para quem edita (GET por id): inclui o PDF em base64.
export function toAlvaraDTO(row: AlvaraRowFull, withFile = false): Alvara {
  return {
    id: row.id,
    name: row.name,
    number: row.number ?? undefined,
    issuer: row.issuer ?? undefined,
    issuedAt: row.issuedAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    fileName: row.fileName ?? undefined,
    hasFile: Boolean(row.fileData || row.filePath),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    companyId: row.companyId,
    company: row.company
      ? {
          id: row.company.id,
          razaoSocial: row.company.razaoSocial,
          cnpj: row.company.cnpj,
        }
      : null,
    ...(withFile && { fileData: row.fileData ?? undefined }),
  };
}

export type AlvaraCreateInput = {
  name: string;
  number: string | null;
  issuer: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  fileName: string | null;
  fileData: string | null;
  notes: string | null;
  companyId: string | null;
};

// Datas são opcionais (alvará sem vencimento é permanente), mas se
// vierem precisam ser válidas.
function parseOptionalDate(value: unknown): Date | null | undefined {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseAlvaraBody(body: unknown): AlvaraCreateInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Partial<Alvara>;

  if (typeof b.name !== "string" || b.name.trim() === "") return null;
  const issuedAt = parseOptionalDate(b.issuedAt);
  const expiresAt = parseOptionalDate(b.expiresAt);
  if (issuedAt === undefined || expiresAt === undefined) return null;

  return {
    name: b.name.trim(),
    number: b.number?.trim() ? b.number.trim() : null,
    issuer: b.issuer?.trim() ? b.issuer.trim() : null,
    issuedAt,
    expiresAt,
    fileName: b.fileName || null,
    fileData: b.fileData || null,
    notes: b.notes?.trim() ? b.notes.trim() : null,
    companyId:
      typeof b.companyId === "string" && b.companyId ? b.companyId : null,
  };
}
