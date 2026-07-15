import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api-auth";
import { SECTORS, type SectorKey } from "@/lib/sectors";
import { toUserDTO, USER_SELECT } from "@/lib/user-api";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

// Atualiza nome/setor/perfil e, se enviada, a senha.
export async function PUT(req: Request, { params }: Params) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as {
    name?: string;
    sector?: SectorKey;
    profileId?: string;
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
  const profile = b.profileId
    ? await prisma.permissionProfile.findUnique({ where: { id: b.profileId } })
    : null;
  if (!profile) {
    return NextResponse.json(
      { error: "Escolha um perfil de acesso para o usuário." },
      { status: 400 },
    );
  }
  // Não deixa o admin rebaixar a si mesmo e trancar o cofre sem administrador.
  if (id === auth.sub && !profile.admin) {
    return NextResponse.json(
      { error: "Você não pode remover seu próprio acesso de administrador." },
      { status: 400 },
    );
  }

  try {
    const row = await prisma.user.update({
      where: { id },
      data: {
        name: b.name.trim(),
        sector: b.sector as SectorKey,
        profileId: profile.id,
        ...(b.password ? { passwordHash: bcrypt.hashSync(b.password, 10) } : {}),
      },
      select: USER_SELECT,
    });
    return NextResponse.json(toUserDTO(row));
  } catch {
    return notFound();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (id === auth.sub) {
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
