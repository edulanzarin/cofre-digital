// Tipos e helpers dos alvarás/licenças. Diferente dos certificados,
// as datas são opcionais: alvará sem vencimento é permanente.

import { DEFAULT_ALERT_DAYS } from "./certificates";

export type AlvaraCompany = { id: string; razaoSocial: string; cnpj: string };

export type Alvara = {
  id: string;
  kind: AlvaraKind;
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

// Categoria do documento. Quem é dispensado do alvará guarda no lugar dele a
// dispensa do município ou a Declaração de Direitos de Liberdade Econômica
// (atividade de baixo risco, emitida pela Junta). Antes a dispensa era só uma
// sugestão no nome, e a equipe pediu um lugar para marcar o que o documento é.
// As datas continuam opcionais nas três: há município que exige renovar a
// dispensa, e a declaração em geral não vence.
export type AlvaraKind = "alvara" | "dispensa" | "declaracao";

export const ALVARA_KINDS: readonly AlvaraKind[] = ["alvara", "dispensa", "declaracao"];

// `suggestions` alimenta o datalist do nome (texto livre); a primeira entra
// sozinha quando a categoria muda e o nome ainda é uma sugestão.
export const ALVARA_KIND_META: Record<
  AlvaraKind,
  { label: string; placeholder: string; suggestions: string[] }
> = {
  alvara: {
    label: "Alvará",
    placeholder: "Alvará de Funcionamento, Sanitário…",
    suggestions: [
      "Alvará de Funcionamento",
      "Alvará Sanitário",
      "Alvará do Corpo de Bombeiros (AVCB)",
      "Licença Ambiental",
      "Alvará de Publicidade",
    ],
  },
  dispensa: {
    label: "Dispensa",
    placeholder: "Dispensa de Alvará, de Licença Sanitária…",
    suggestions: [
      "Dispensa de Alvará",
      "Dispensa de Licença Sanitária",
      "Dispensa de Licença Ambiental",
    ],
  },
  declaracao: {
    label: "Declaração",
    placeholder: "Declaração de Direitos de Liberdade Econômica",
    suggestions: ["Declaração de Direitos de Liberdade Econômica"],
  },
};

export function isAlvaraKind(value: unknown): value is AlvaraKind {
  return ALVARA_KINDS.includes(value as AlvaraKind);
}
