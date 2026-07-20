import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALVARA_INCLUDE, parseAlvaraBody, toAlvaraDTO } from "@/lib/alvara-api";
import { guard } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await guard("alvaras", "view");
  if (auth instanceof NextResponse) return auth;
  const companyId = new URL(req.url).searchParams.get("companyId");
  const rows = await prisma.alvara.findMany({
    where: companyId ? { companyId } : undefined,
    // Vencimentos mais próximos primeiro; os sem vencimento por último.
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    include: ALVARA_INCLUDE,
  });
  return NextResponse.json(rows.map((r) => toAlvaraDTO(r)));
}

export async function POST(req: Request) {
  const auth = await guard("alvaras", "edit");
  if (auth instanceof NextResponse) return auth;
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
  const row = await prisma.alvara.create({
    data: {
      ...data,
      events: { create: { kind: "created", userName: auth.name } },
    },
    include: ALVARA_INCLUDE,
  });
  return NextResponse.json(toAlvaraDTO(row, true), { status: 201 });
}
