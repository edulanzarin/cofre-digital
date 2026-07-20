import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { parseGroupBody, toGroupDTO } from "@/lib/company-group-api";

const GROUP_INCLUDE = { _count: { select: { companies: true } } } as const;

export async function GET() {
  const auth = await guard("empresas", "view");
  if (auth instanceof NextResponse) return auth;
  const rows = await prisma.companyGroup.findMany({
    orderBy: { name: "asc" },
    include: GROUP_INCLUDE,
  });
  return NextResponse.json(rows.map(toGroupDTO));
}

export async function POST(req: Request) {
  const auth = await guard("empresas", "edit");
  if (auth instanceof NextResponse) return auth;
  const data = parseGroupBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json({ error: "Informe o nome do grupo." }, { status: 400 });
  }
  const duplicate = await prisma.companyGroup.findUnique({
    where: { name: data.name },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Já existe um grupo com esse nome." }, { status: 409 });
  }
  const row = await prisma.companyGroup.create({
    data,
    include: GROUP_INCLUDE,
  });
  return NextResponse.json(toGroupDTO(row), { status: 201 });
}
