// Tipos e dados seed do cofre. Quando o backend entrar (Prisma),
// este módulo vira a camada de queries e os tipos migram pro schema.

export type CertType = "e-CNPJ A1" | "e-CPF A1" | "e-CNPJ A3" | "e-CPF A3" | "NF-e";

// A1/NF-e são arquivos .pfx; A3 vive num cartão ou token físico.
export type CertMedia = "file" | "card";

export type CertCompany = { id: string; razaoSocial: string; cnpj: string };

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

