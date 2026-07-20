// Conversões e validação dos grupos de empresas.

import type { CompanyGroup } from "./companyGroups";

type GroupRow = {
  id: string;
  name: string;
  _count?: { companies: number };
};

export function toGroupDTO(row: GroupRow): CompanyGroup {
  return {
    id: row.id,
    name: row.name,
    companyCount: row._count?.companies ?? 0,
  };
}

export function parseGroupBody(body: unknown): { name: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as { name?: unknown };
  if (typeof b.name !== "string") return null;
  const name = b.name.trim();
  if (name === "") return null;
  return { name };
}
