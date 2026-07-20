import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALVARA_INCLUDE, parseAlvaraBody, toAlvaraDTO } from "@/lib/alvara-api";
import { guard } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Alvará não encontrado." }, { status: 404 });

// Com o PDF em base64 — quem edita (usado pelo modal de edição).
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("alvaras", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.alvara.findUnique({
    where: { id },
    include: ALVARA_INCLUDE,
  });
  if (!row) return notFound();
  return NextResponse.json(toAlvaraDTO(row, true));
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await guard("alvaras", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const data = parseAlvaraBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json(
      { error: "Dados do alvará inválidos — informe ao menos o tipo." },
      { status: 400 },
    );
  }
  if (data.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { id: true },
    });
    if (!company) data.companyId = null;
  }
  try {
    const before = await prisma.alvara.findUniqueOrThrow({
      where: { id },
      select: { expiresAt: true },
    });
    const renewed =
      (before.expiresAt?.getTime() ?? null) !== (data.expiresAt?.getTime() ?? null);
    const row = await prisma.alvara.update({
      where: { id },
      data: {
        ...data,
        events: {
          create: {
            kind: "updated",
            userName: auth.name,
            message: renewed ? "Novo vencimento registrado." : null,
          },
        },
      },
      include: ALVARA_INCLUDE,
    });
    return NextResponse.json(toAlvaraDTO(row, true));
  } catch {
    return notFound();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guard("alvaras", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await prisma.alvara.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
