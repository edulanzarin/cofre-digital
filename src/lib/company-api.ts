// Conversões e validação das empresas (donas dos cofres).

import { formatMoney } from "./money";
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
  honorarios: number | null;
  alteracaoContratual: number | null;
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
    honorarios: row.honorarios,
    alteracaoContratual: row.alteracaoContratual,
    createdAt: row.createdAt.toISOString(),
    certCount: row._count?.certificates ?? 0,
    accessCount: row._count?.accesses ?? 0,
    alvaraCount: row._count?.alvaras ?? 0,
    nextExpiresAt: row.certificates?.[0]?.expiresAt.toISOString() ?? null,
  };
}

export type CompanyData = {
  cnpj: string;
  razaoSocial: string;
  groupId: string | null;
  honorarios: number | null;
  alteracaoContratual: number | null;
};

export type ParseResult =
  | { ok: true; data: CompanyData }
  | { ok: false; error: string };

const MAX_CENTS = 99_999_999_999; // R$ 999.999.999,99

// Valor em centavos: inteiro, não negativo, dentro do teto. Ausente,
// vazio ou nulo = não informado — o campo é opcional.
function parseCents(
  raw: unknown,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > MAX_CENTS) {
    return { ok: false, error: `Valor inválido em ${label}.` };
  }
  return { ok: true, value: n };
}

// `groupId` ausente ou vazio = empresa sem grupo. O vínculo é opcional:
// grupo é conveniência de filtro, não obrigação de cadastro.
export function parseCompanyBody(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Dados da empresa ausentes." };
  }
  const b = body as {
    cnpj?: unknown;
    razaoSocial?: unknown;
    groupId?: unknown;
    honorarios?: unknown;
    alteracaoContratual?: unknown;
  };
  if (typeof b.razaoSocial !== "string" || b.razaoSocial.trim() === "") {
    return { ok: false, error: "Informe a razão social." };
  }
  if (typeof b.cnpj !== "string" || b.cnpj.replace(/\D/g, "").length !== 14) {
    return { ok: false, error: "Informe um CNPJ válido (14 dígitos)." };
  }
  const honorarios = parseCents(b.honorarios, "honorário mensal");
  if (!honorarios.ok) return honorarios;
  const alteracao = parseCents(b.alteracaoContratual, "alteração contratual");
  if (!alteracao.ok) return alteracao;

  return {
    ok: true,
    data: {
      cnpj: b.cnpj.replace(/\D/g, ""),
      razaoSocial: b.razaoSocial.trim(),
      groupId: typeof b.groupId === "string" && b.groupId !== "" ? b.groupId : null,
      honorarios: honorarios.value,
      alteracaoContratual: alteracao.value,
    },
  };
}

// --- Histórico: descrever só o que mudou ---

export type CompanySnapshot = {
  razaoSocial: string;
  cnpj: string;
  groupName: string | null;
  honorarios: number | null;
  alteracaoContratual: number | null;
};

export function companySnapshot(row: {
  razaoSocial: string;
  cnpj: string;
  group?: { name: string } | null;
  honorarios: number | null;
  alteracaoContratual: number | null;
}): CompanySnapshot {
  return {
    razaoSocial: row.razaoSocial,
    cnpj: row.cnpj,
    groupName: row.group?.name ?? null,
    honorarios: row.honorarios,
    alteracaoContratual: row.alteracaoContratual,
  };
}

// Como a empresa entrou: só os valores que já vieram preenchidos.
export function describeCompanyCreation(data: CompanyData): string | null {
  const lines: string[] = [];
  if (data.honorarios !== null) {
    lines.push(`• Honorário mensal: ${formatMoney(data.honorarios)}`);
  }
  if (data.alteracaoContratual !== null) {
    lines.push(`• Alteração contratual: ${formatMoney(data.alteracaoContratual)}`);
  }
  return lines.length ? lines.join("\n") : null;
}

// "• Honorário mensal: R$ 800,00 → R$ 950,00". Sem mudança nenhuma devolve
// null, e o chamador não grava evento vazio no histórico.
export function describeCompanyChanges(
  before: CompanySnapshot,
  after: CompanySnapshot,
): string | null {
  const lines: string[] = [];
  const field = (label: string, a: string, b: string) => {
    if (a !== b) lines.push(`• ${label}: ${a || "—"} → ${b || "—"}`);
  };

  field("Razão social", before.razaoSocial, after.razaoSocial);
  field("CNPJ", before.cnpj, after.cnpj);
  field("Grupo", before.groupName ?? "", after.groupName ?? "");
  if (before.honorarios !== after.honorarios) {
    lines.push(
      `• Honorário mensal: ${formatMoney(before.honorarios)} → ${formatMoney(after.honorarios)}`,
    );
  }
  if (before.alteracaoContratual !== after.alteracaoContratual) {
    lines.push(
      `• Alteração contratual: ${formatMoney(before.alteracaoContratual)} → ${formatMoney(after.alteracaoContratual)}`,
    );
  }

  return lines.length ? lines.join("\n") : null;
}
