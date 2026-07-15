// Módulos do cofre e níveis de acesso dos perfis de permissão.
// Um perfil é um "padrão de configuração" reutilizável: define o nível
// por módulo e é aplicado a quantos usuários for preciso.

export const MODULES = ["empresas", "certificados", "acessos"] as const;
export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  empresas: "Empresas",
  certificados: "Certificados",
  acessos: "Acessos",
};

export const LEVELS = ["none", "view", "edit"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  none: "Sem acesso",
  view: "Visualiza",
  edit: "Edita",
};

export type PermissionRules = Partial<Record<ModuleKey, Level>>;

// O que o front e as rotas precisam saber sobre quem está logado.
export type Perms = { admin: boolean; rules: PermissionRules };

export type Profile = {
  id: string;
  name: string;
  admin: boolean;
  rules: PermissionRules;
  userCount?: number;
};

const ORDER: Record<Level, number> = { none: 0, view: 1, edit: 2 };

export function levelFor(perms: Perms | null | undefined, module: ModuleKey): Level {
  if (!perms) return "none";
  if (perms.admin) return "edit";
  return perms.rules[module] ?? "none";
}

export function allows(
  perms: Perms | null | undefined,
  module: ModuleKey,
  min: Level,
): boolean {
  return ORDER[levelFor(perms, module)] >= ORDER[min];
}

// Sanitiza o JSON de regras vindo do banco ou de uma requisição.
export function parseRules(raw: unknown): PermissionRules {
  if (typeof raw !== "object" || raw === null) return {};
  const rules: PermissionRules = {};
  for (const key of MODULES) {
    const value = (raw as Record<string, unknown>)[key];
    if (LEVELS.includes(value as Level)) rules[key] = value as Level;
  }
  return rules;
}
