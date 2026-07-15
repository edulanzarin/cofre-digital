import type { Access as AccessRow } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import {
  LOGIN_TYPES,
  type Access,
  type LinkedCertificate,
  type LoginType,
} from "./accesses";

// Compara links ignorando protocolo, www, barra final e maiúsculas.
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const host = u.host.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}${u.search}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

// Dois acessos não podem apontar pro mesmo site.
export async function findDuplicateUrl(url: string, excludeId?: string) {
  const target = normalizeUrl(url);
  const rows = await prisma.access.findMany({
    select: { id: true, name: true, url: true },
  });
  return rows.find((r) => r.id !== excludeId && normalizeUrl(r.url) === target);
}

// Sempre buscar acessos com este include: o front mostra o certificado
// vinculado e a empresa dona.
export const ACCESS_INCLUDE = {
  certificate: {
    select: {
      id: true,
      holder: true,
      type: true,
      issuedAt: true,
      expiresAt: true,
    },
  },
  company: { select: { id: true, razaoSocial: true, cnpj: true } },
} as const;

type AccessRowFull = AccessRow & {
  certificate: {
    id: string;
    holder: string;
    type: string;
    issuedAt: Date;
    expiresAt: Date;
  } | null;
  company: { id: string; razaoSocial: string; cnpj: string } | null;
};

// `tutorial`: quem vê acessos pode ler (é o manual); a listagem omite por peso.
// `secrets`: senha, só para quem edita.
export function toAccessDTO(
  row: AccessRowFull,
  opts: { tutorial?: boolean; secrets?: boolean } = {},
): Access {
  const certificate: LinkedCertificate | null = row.certificate
    ? {
        id: row.certificate.id,
        holder: row.certificate.holder,
        type: row.certificate.type,
        issuedAt: row.certificate.issuedAt.toISOString(),
        expiresAt: row.certificate.expiresAt.toISOString(),
      }
    : null;

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    loginType: row.loginType as LoginType,
    loginValue: row.loginValue,
    certificateId: row.certificateId,
    certificate,
    companyId: row.companyId,
    company: row.company
      ? {
          id: row.company.id,
          razaoSocial: row.company.razaoSocial,
          cnpj: row.company.cnpj,
        }
      : null,
    notes: row.notes ?? undefined,
    ...(opts.tutorial ? { tutorial: row.tutorial ?? undefined } : {}),
    hasTutorial: Boolean(row.tutorial?.trim()),
    updatedAt: row.updatedAt.toISOString(),
    ...(opts.secrets && { password: row.password }),
  };
}

export type AccessInput = {
  name: string;
  url: string;
  loginType: string;
  loginValue: string;
  password: string;
  certificateId: string | null;
  companyId: string | null;
  notes: string | null;
  tutorial: string | null;
};

export function parseAccessBody(body: unknown): AccessInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Partial<Access>;

  if (typeof b.name !== "string" || b.name.trim() === "") return null;
  if (typeof b.url !== "string" || b.url.trim() === "") return null;
  if (!LOGIN_TYPES.includes(b.loginType as LoginType)) return null;

  const byCertificate = b.loginType === "Certificado digital";

  if (byCertificate) {
    // Login por certificado: exige o vínculo; credenciais vêm do certificado.
    if (typeof b.certificateId !== "string" || !b.certificateId) return null;
  } else {
    if (typeof b.loginValue !== "string" || b.loginValue.trim() === "") return null;
    if (typeof b.password !== "string" || b.password === "") return null;
  }

  return {
    name: b.name.trim(),
    url: b.url.trim(),
    loginType: b.loginType as string,
    loginValue: byCertificate ? "" : (b.loginValue as string).trim(),
    password: byCertificate ? "" : (b.password as string),
    certificateId: byCertificate ? (b.certificateId as string) : null,
    companyId:
      typeof b.companyId === "string" && b.companyId ? b.companyId : null,
    notes: b.notes?.trim() ? b.notes.trim() : null,
    tutorial: b.tutorial?.trim() ? b.tutorial : null,
  };
}
