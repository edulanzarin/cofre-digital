import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { forbidden, requireEditor } from "@/lib/api-auth";
import { SECTORS, type SectorKey } from "@/lib/sectors";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

// Atualiza nome/setor e, se enviada, a senha.
export async function PUT(req: Request, { params }: Params) {
  const session = await requireEditor();
  if (!session) return forbidden();
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as {
    name?: string;
    sector?: SectorKey;
    password?: string;
  } | null;

  if (!b?.name?.trim() || !SECTORS.includes(b.sector as SectorKey)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (b.password && b.password.length < 6) {
    return NextResponse.json(
      { error: "Senha mínima de 6 caracteres." },
      { status: 400 },
    );
  }
  // Não deixa o Societário rebaixar o próprio setor e trancar o cofre sem admin.
  if (id === session.sub && b.sector !== "SOCIETARIO") {
    return NextResponse.json(
      { error: "Você não pode remover seu próprio acesso de Societário." },
      { status: 400 },
    );
  }

  try {
    const row = await prisma.user.update({
      where: { id },
      data: {
        name: b.name.trim(),
        sector: b.sector as SectorKey,
        ...(b.password ? { passwordHash: bcrypt.hashSync(b.password, 10) } : {}),
      },
      select: { id: true, name: true, email: true, sector: true },
    });
    return NextResponse.json(row);
  } catch {
    return notFound();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireEditor();
  if (!session) return forbidden();
  const { id } = await params;
  if (id === session.sub) {
    return NextResponse.json(
      { error: "Você não pode excluir a si mesmo." },
      { status: 400 },
    );
  }
  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
