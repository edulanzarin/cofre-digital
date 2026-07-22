// Grupo econômico sem nenhuma empresa não tem razão de existir — ele só serve
// para filtrar o cofre de um punhado de empresas de uma vez. Quando a última
// empresa sai (troca de grupo, exclusão da empresa) ou um grupo é criado à toa
// e nunca vinculado, ele é varrido daqui. É o que substitui a antiga faxina
// manual da aba de grupos.

import { prisma } from "./prisma";
import { allows } from "./permissions";
import type { AuthUser } from "./api-auth";

export async function pruneEmptyGroups(): Promise<void> {
  await prisma.companyGroup.deleteMany({
    where: { companies: { none: {} } },
  });
}

// Vindo do formulário de certificado: o grupo é atribuído à empresa dona do
// cofre, não ao certificado. Só atribui (nunca desvincula) e exige permissão
// de empresas — o cert em si é guardado por quem edita certificados, mas mexer
// no grupo é ação de empresa. `rawGroupId` vazio = não toca no grupo da empresa.
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
  // Reatribuir pode ter esvaziado o grupo de onde a empresa saiu.
  await pruneEmptyGroups();
}
