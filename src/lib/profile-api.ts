// Conversões e validação dos perfis de acesso.

import { parseRules, type PermissionRules, type Profile } from "./permissions";

export function toProfileDTO(row: {
  id: string;
  name: string;
  admin: boolean;
  rules: unknown;
  _count?: { users: number };
}): Profile {
  return {
    id: row.id,
    name: row.name,
    admin: row.admin,
    rules: parseRules(row.rules),
    userCount: row._count?.users ?? 0,
  };
}

export function parseProfileBody(
  body: unknown,
): { name: string; admin: boolean; rules: PermissionRules } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as { name?: unknown; admin?: unknown; rules?: unknown };
  if (typeof b.name !== "string" || b.name.trim() === "") return null;
  return {
    name: b.name.trim(),
    admin: b.admin === true,
    rules: parseRules(b.rules),
  };
}
