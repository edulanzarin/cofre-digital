import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api-auth";
import { parseProfileBody, toProfileDTO } from "@/lib/profile-api";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

export async function PUT(req: Request, { params }: Params) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const data = parseProfileBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json({ error: "Dados do perfil inválidos." }, { status: 400 });
  }
  const duplicate = await prisma.permissionProfile.findFirst({
    where: { name: data.name, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "Já existe um perfil com este nome." },
      { status: 409 },
    );
  }
  // Não deixa o admin tirar o próprio poder editando o perfil que usa.
  if (!data.admin) {
    const self = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { profileId: true },
    });
    if (self?.profileId === id) {
      return NextResponse.json(
        { error: "Este é o seu perfil — você não pode remover o próprio acesso de administrador." },
        { status: 400 },
      );
    }
  }
  try {
    const row = await prisma.permissionProfile.update({
      where: { id },
      data,
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(toProfileDTO(row));
  } catch {
    return notFound();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const inUse = await prisma.user.count({ where: { profileId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Este perfil está aplicado a ${inUse} usuário(s) — troque o perfil deles antes de excluir.` },
      { status: 400 },
    );
  }
  try {
    await prisma.permissionProfile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
