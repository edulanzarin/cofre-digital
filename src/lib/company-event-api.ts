// DTO da linha do tempo da empresa. Mora aqui, e não na route, porque
// route do App Router só exporta handler HTTP — qualquer outro export
// reprova na checagem de tipos do build.

export function toCompanyEventDTO(row: {
  id: string;
  kind: string;
  message: string | null;
  pinned: boolean;
  userName: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    kind: row.kind,
    message: row.message ?? undefined,
    pinned: row.pinned,
    userName: row.userName,
    createdAt: row.createdAt.toISOString(),
  };
}
