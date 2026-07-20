import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { parseGroupBody, toGroupDTO } from "@/lib/company-group-api";

type Params = { params: Promise<{ id: string }> };

const GROUP_INCLUDE = { _count: { select: { companies: true } } } as const;

const notFound = () =>
  NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });

export async function PUT(req: Request, { params }: Params) {
  const auth = await guard("empresas", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const data = parseGroupBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json({ error: "Informe o nome do grupo." }, { status: 400 });
  }
  const duplicate = await prisma.companyGroup.findFirst({
    where: { name: data.name, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Já existe um grupo com esse nome." }, { status: 409 });
  }
  try {
    const row = await prisma.companyGroup.update({
      where: { id },
      data,
      include: GROUP_INCLUDE,
    });
    return NextResponse.json(toGroupDTO(row));
  } catch {
    return notFound();
  }
}

// Excluir o grupo não apaga empresa nenhuma: elas só voltam a ficar
// sem grupo (groupId vira null).
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guard("empresas", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await prisma.companyGroup.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
