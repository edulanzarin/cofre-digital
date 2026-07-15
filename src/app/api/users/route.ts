import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api-auth";
import { SECTORS, type SectorKey } from "@/lib/sectors";
import { toUserDTO, USER_SELECT } from "@/lib/user-api";

export async function GET() {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const rows = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: USER_SELECT,
  });
  return NextResponse.json(rows.map(toUserDTO));
}

export async function POST(req: Request) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const b = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    sector?: SectorKey;
    profileId?: string;
  } | null;

  if (
    !b?.name?.trim() ||
    !b.email?.trim() ||
    !b.password ||
    b.password.length < 6 ||
    !SECTORS.includes(b.sector as SectorKey)
  ) {
    return NextResponse.json(
      { error: "Dados inválidos (senha mínima de 6 caracteres)." },
      { status: 400 },
    );
  }

  if (
    !b.profileId ||
    !(await prisma.permissionProfile.findUnique({ where: { id: b.profileId } }))
  ) {
    return NextResponse.json(
      { error: "Escolha um perfil de acesso para o usuário." },
      { status: 400 },
    );
  }

  const email = b.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 409 });
  }

  const row = await prisma.user.create({
    data: {
      name: b.name.trim(),
      email,
      passwordHash: bcrypt.hashSync(b.password, 10),
      sector: b.sector as SectorKey,
      profileId: b.profileId,
    },
    select: USER_SELECT,
  });
  return NextResponse.json(toUserDTO(row), { status: 201 });
}
