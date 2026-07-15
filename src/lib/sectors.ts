// Setores da Navecon — informativo; quem manda é o perfil de acesso.

export const SECTORS = [
  "SOCIETARIO",
  "FISCAL",
  "CONTABIL",
  "DP",
  "CONTROLADORIA",
  "COMERCIAL",
  "ADMINISTRATIVO",
] as const;

export type SectorKey = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<SectorKey, string> = {
  SOCIETARIO: "Societário",
  FISCAL: "Fiscal",
  CONTABIL: "Contábil",
  DP: "Departamento Pessoal",
  CONTROLADORIA: "Controladoria",
  COMERCIAL: "Comercial",
  ADMINISTRATIVO: "Administrativo",
};

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  sector: SectorKey;
  profileId: string | null;
  profileName: string | null;
  profileAdmin: boolean;
};
