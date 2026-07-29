// Tipos e dados seed do cofre. Quando o backend entrar (Prisma),
// este módulo vira a camada de queries e os tipos migram pro schema.

export type CertType = "e-CNPJ A1" | "e-CPF A1" | "e-CNPJ A3" | "e-CPF A3" | "NF-e";

// A1/NF-e são arquivos .pfx; A3 vive num cartão ou token físico.
export type CertMedia = "file" | "card";

export type CertCompany = {
  id: string;
  razaoSocial: string;
  cnpj: string;
  groupId?: string | null; // grupo econômico, para filtrar o cofre por grupo
  group?: { name: string } | null; // nome do grupo, para a coluna
};

export type Certificate = {
  id: string;
  holder: string; // titular (empresa ou pessoa)
  document: string; // CNPJ ou CPF formatado
  type: CertType;
  media: CertMedia;
  issuer: string; // AC emissora
  issuedAt: string; // ISO
  expiresAt: string; // ISO
  password?: string; // só vem no GET por id (quem edita)
  fileName?: string;
  fileData?: string; // só no GET por id (quem edita)
  hasFile?: boolean; // na listagem, indica se dá pra baixar
  notes?: string;
  createdAt?: string; // ISO — quando entrou no cofre
  updatedAt?: string; // ISO — última alteração
  companyId?: string | null;
  company?: CertCompany | null; // empresa dona do cofre
  // Grupo EFETIVO do certificado: o da empresa dona quando há uma, senão o
  // escolhido direto no cert (e-CPF avulso). É o que filtro e coluna usam.
  groupId?: string | null;
  group?: { name: string } | null;
};

export type CertStatus = "valid" | "expiring" | "expired";

const DAY = 24 * 60 * 60 * 1000;

// Janela padrão de "vencendo"; a efetiva vem das configurações.
export const DEFAULT_ALERT_DAYS = 45;

export function daysLeft(cert: Pick<Certificate, "expiresAt">): number {
  return Math.ceil((new Date(cert.expiresAt).getTime() - Date.now()) / DAY);
}

export function certStatus(
  cert: Pick<Certificate, "expiresAt">,
  alertDays: number = DEFAULT_ALERT_DAYS,
): CertStatus {
  const d = daysLeft(cert);
  if (d < 0) return "expired";
  if (d <= alertDays) return "expiring";
  return "valid";
}

export function lifePercent(cert: Pick<Certificate, "issuedAt" | "expiresAt">): number {
  const start = new Date(cert.issuedAt).getTime();
  const end = new Date(cert.expiresAt).getTime();
  const p = ((Date.now() - start) / (end - start)) * 100;
  return Math.min(100, Math.max(0, p));
}

export const STATUS_META: Record<
  CertStatus,
  { label: string; color: string; soft: string }
> = {
  valid: { label: "Válido", color: "var(--ok)", soft: "var(--ok-soft)" },
  expiring: { label: "Vencendo", color: "var(--warn)", soft: "var(--warn-soft)" },
  expired: { label: "Vencido", color: "var(--bad)", soft: "var(--bad-soft)" },
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Agrupa pro dashboard: 14 dígitos = e-CNPJ (inclui NF-e), senão e-CPF.
export function docGroup(cert: Pick<Certificate, "document">): "cnpj" | "cpf" {
  return cert.document.replace(/\D/g, "").length === 14 ? "cnpj" : "cpf";
}

// Formata uma sequência de dígitos como CNPJ (14) ou CPF (11).
export function formatDocument(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return digits;
}

// Espécie do documento pelo tamanho: 14 dígitos = CNPJ, 11 = CPF, senão null
// (tamanho incompleto/estranho). Ignora pontuação.
export function documentKind(document: string): "cnpj" | "cpf" | null {
  const d = document.replace(/\D/g, "");
  if (d.length === 14) return "cnpj";
  if (d.length === 11) return "cpf";
  return null;
}

// Dígitos verificadores do CPF. Barra sequências repetidas ("111.111.111-11")
// e qualquer número digitado errado — a rede de segurança contra criar empresa
// (ou vincular certificado) num documento que não existe.
export function isValidCpf(document: string): boolean {
  const c = document.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(c[9]) && digit(10) === Number(c[10]);
}

// Dígitos verificadores do CNPJ (numérico). Mesma ideia do CPF.
export function isValidCnpj(document: string): boolean {
  const c = document.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const check = (weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(c[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(weights1) === Number(c[12]) && check(weights2) === Number(c[13]);
}

// Documento válido: tamanho de CPF/CNPJ E dígitos verificadores conferem.
export function isValidDocument(document: string): boolean {
  const kind = documentKind(document);
  if (kind === "cpf") return isValidCpf(document);
  if (kind === "cnpj") return isValidCnpj(document);
  return false;
}

// O tipo do certificado combina com a espécie do documento?
// e-CNPJ e NF-e são de CNPJ (14 dígitos); e-CPF é de CPF (11).
export function typeMatchesDocument(type: CertType, document: string): boolean {
  const kind = documentKind(document);
  if (!kind) return false;
  const wantsCnpj = type.startsWith("e-CNPJ") || type === "NF-e";
  return wantsCnpj ? kind === "cnpj" : kind === "cpf";
}

