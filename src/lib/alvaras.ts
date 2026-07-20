// Tipos e helpers dos alvarás/licenças. Diferente dos certificados,
// as datas são opcionais: alvará sem vencimento é permanente.

import { DEFAULT_ALERT_DAYS } from "./certificates";

export type AlvaraCompany = { id: string; razaoSocial: string; cnpj: string };

export type Alvara = {
  id: string;
  name: string; // ex.: Alvará de Funcionamento
  number?: string; // número/protocolo do documento
  issuer?: string; // órgão emissor (prefeitura, corpo de bombeiros…)
  issuedAt?: string; // ISO
  expiresAt?: string; // ISO — ausente = sem vencimento
  fileName?: string;
  fileData?: string; // só no GET por id (quem edita)
  hasFile?: boolean; // na listagem, indica se dá pra abrir o PDF
  notes?: string;
  createdAt?: string; // ISO — quando entrou no cofre
  updatedAt?: string; // ISO — última alteração
  companyId?: string | null;
  company?: AlvaraCompany | null; // empresa dona do cofre
};

// "none" = sem data de vencimento (permanente).
export type AlvaraStatus = "valid" | "expiring" | "expired" | "none";

const DAY = 24 * 60 * 60 * 1000;

export function alvaraDaysLeft(alvara: Pick<Alvara, "expiresAt">): number {
  return Math.ceil(
    (new Date(alvara.expiresAt ?? 0).getTime() - Date.now()) / DAY,
  );
}

export function alvaraStatus(
  alvara: Pick<Alvara, "expiresAt">,
  alertDays: number = DEFAULT_ALERT_DAYS,
): AlvaraStatus {
  if (!alvara.expiresAt) return "none";
  const d = alvaraDaysLeft(alvara);
  if (d < 0) return "expired";
  if (d <= alertDays) return "expiring";
  return "valid";
}

// Mesmas cores da régua dos certificados, para o cofre falar uma língua só.
export const ALVARA_STATUS_META: Record<
  AlvaraStatus,
  { label: string; color: string; soft: string }
> = {
  valid: { label: "Válido", color: "var(--ok)", soft: "var(--ok-soft)" },
  expiring: { label: "Vencendo", color: "var(--warn)", soft: "var(--warn-soft)" },
  expired: { label: "Vencido", color: "var(--bad)", soft: "var(--bad-soft)" },
  none: { label: "Sem vencimento", color: "var(--info)", soft: "var(--info-soft)" },
};

// Sugestões do campo "tipo" no cadastro — texto livre com datalist.
export const ALVARA_SUGGESTIONS = [
  "Alvará de Funcionamento",
  "Alvará Sanitário",
  "Alvará do Corpo de Bombeiros (AVCB)",
  "Licença Ambiental",
  "Alvará de Publicidade",
];
