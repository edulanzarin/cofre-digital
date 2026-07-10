import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { forbidden, requireEditor } from "@/lib/api-auth";
import { SECTORS, type SectorKey } from "@/lib/sectors";

export async function GET() {
  if (!(await requireEditor())) return forbidden();
  const rows = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, sector: true },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  if (!(await requireEditor())) return forbidden();
  const b = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    sector?: SectorKey;
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
    },
    select: { id: true, name: true, email: true, sector: true },
  });
  return NextResponse.json(row, { status: 201 });
}
