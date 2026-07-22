// Vindo do formulário de certificado: o grupo é atribuído à empresa dona do
// cofre, não ao certificado. Só atribui (nunca desvincula) e exige permissão
// de empresas — o cert em si é guardado por quem edita certificados, mas mexer
// no grupo é ação de empresa. `rawGroupId` vazio = não toca no grupo da empresa.
//
// Grupo NÃO é apagado automaticamente em lugar nenhum: só some quando alguém
// clica em excluir. Grupo sem empresa fica lá, à espera de ser reaproveitado.

import { prisma } from "./prisma";
import { allows } from "./permissions";
import type { AuthUser } from "./api-auth";

export async function assignCompanyGroup(
  companyId: string,
  rawGroupId: unknown,
  user: AuthUser,
): Promise<void> {
  if (typeof rawGroupId !== "string" || rawGroupId === "") return;
  if (!allows(user, "empresas", "edit")) return;
  const group = await prisma.companyGroup.findUnique({
    where: { id: rawGroupId },
    select: { id: true },
  });
  if (!group) return;
  await prisma.company.update({
    where: { id: companyId },
    data: { groupId: group.id },
  });
}
