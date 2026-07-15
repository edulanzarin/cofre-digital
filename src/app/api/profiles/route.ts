import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api-auth";
import { parseProfileBody, toProfileDTO } from "@/lib/profile-api";

export async function GET() {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const rows = await prisma.permissionProfile.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });
  return NextResponse.json(rows.map(toProfileDTO));
}

export async function POST(req: Request) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const data = parseProfileBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json({ error: "Dados do perfil inválidos." }, { status: 400 });
  }
  if (await prisma.permissionProfile.findUnique({ where: { name: data.name } })) {
    return NextResponse.json(
      { error: "Já existe um perfil com este nome." },
      { status: 409 },
    );
  }
  const row = await prisma.permissionProfile.create({
    data,
    include: { _count: { select: { users: true } } },
  });
  return NextResponse.json(toProfileDTO(row), { status: 201 });
}
