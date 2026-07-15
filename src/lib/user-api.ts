// Seleção e conversão dos usuários da equipe.

import type { TeamUser } from "./sectors";

export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  sector: true,
  profile: { select: { id: true, name: true, admin: true } },
} as const;

export function toUserDTO(row: {
  id: string;
  name: string;
  email: string;
  sector: string;
  profile: { id: string; name: string; admin: boolean } | null;
}): TeamUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    sector: row.sector as TeamUser["sector"],
    profileId: row.profile?.id ?? null,
    profileName: row.profile?.name ?? null,
    profileAdmin: row.profile?.admin ?? false,
  };
}
