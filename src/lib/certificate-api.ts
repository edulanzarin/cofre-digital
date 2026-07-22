// Conversões entre o modelo do banco e o DTO usado pelo front,
// mais a validação do corpo das requisições.

import type { Certificate as CertificateRow } from "@/generated/prisma/client";
import type { Certificate, CertMedia, CertType } from "./certificates";

const CERT_TYPES: CertType[] = [
  "e-CNPJ A1",
  "e-CPF A1",
  "e-CNPJ A3",
  "e-CPF A3",
  "NF-e",
];

// Sempre buscar certificados com este include: o front mostra a empresa dona,
// filtra por grupo econômico (groupId) e exibe o nome do grupo na coluna.
export const CERT_INCLUDE = {
  company: {
    select: {
      id: true,
      razaoSocial: true,
      cnpj: true,
      groupId: true,
      group: { select: { name: true } },
    },
  },
} as const;

type CertRowFull = CertificateRow & {
  company: {
    id: string;
    razaoSocial: string;
    cnpj: string;
    groupId: string | null;
    group: { name: string } | null;
  } | null;
};

// `secrets` só para quem edita (GET por id): inclui senha e arquivo.
export function toDTO(row: CertRowFull, secrets = false): Certificate {
  return {
    id: row.id,
    holder: row.holder,
    document: row.document,
    type: row.type as CertType,
    media: row.media === "CARD" ? "card" : "file",
    issuer: row.issuer,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
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
          groupId: row.company.groupId,
          group: row.company.group,
        }
      : null,
    ...(secrets && {
      password: row.password,
      fileData: row.fileData ?? undefined,
    }),
  };
}

export type CertCreateInput = {
  holder: string;
  document: string;
  type: string;
  media: "FILE" | "CARD";
  issuer: string;
  issuedAt: Date;
  expiresAt: Date;
  password: string;
  fileName: string | null;
  fileData: string | null;
  notes: string | null;
  companyId: string | null;
};

export function parseCertBody(body: unknown): CertCreateInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Partial<Certificate>;

  const required = [b.holder, b.document, b.issuer, b.password] as const;
  if (required.some((v) => typeof v !== "string" || v.trim() === "")) return null;
  if (!CERT_TYPES.includes(b.type as CertType)) return null;

  const media: CertMedia = b.media === "card" ? "card" : "file";
  const issuedAt = new Date(b.issuedAt ?? "");
  const expiresAt = new Date(b.expiresAt ?? "");
  if (Number.isNaN(issuedAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  return {
    holder: (b.holder as string).trim(),
    document: (b.document as string).trim(),
    type: b.type as string,
    media: media === "card" ? "CARD" : "FILE",
    issuer: (b.issuer as string).trim(),
    issuedAt,
    expiresAt,
    password: b.password as string,
    fileName: media === "file" && b.fileName ? b.fileName : null,
    fileData: media === "file" && b.fileData ? b.fileData : null,
    notes: b.notes?.trim() ? b.notes.trim() : null,
    companyId:
      typeof b.companyId === "string" && b.companyId ? b.companyId : null,
  };
}
