import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { parseCompanyBody, toCompanyDTO } from "@/lib/company-api";

export async function GET() {
  const auth = await guard("empresas", "view");
  if (auth instanceof NextResponse) return auth;
  const rows = await prisma.company.findMany({
    orderBy: { razaoSocial: "asc" },
    include: {
      _count: { select: { certificates: true, accesses: true } },
      certificates: {
        select: { expiresAt: true },
        orderBy: { expiresAt: "asc" },
        take: 1,
      },
    },
  });
  return NextResponse.json(rows.map(toCompanyDTO));
}

export async function POST(req: Request) {
  const auth = await guard("empresas", "edit");
  if (auth instanceof NextResponse) return auth;
  const data = parseCompanyBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json(
      { error: "Informe a razão social e um CNPJ válido (14 dígitos)." },
      { status: 400 },
    );
  }
  const duplicate = await prisma.company.findUnique({
    where: { cnpj: data.cnpj },
    select: { razaoSocial: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `Este CNPJ já está cadastrado (${duplicate.razaoSocial}).` },
      { status: 409 },
    );
  }
  const row = await prisma.company.create({
    data,
    include: {
      _count: { select: { certificates: true, accesses: true } },
      certificates: {
        select: { expiresAt: true },
        orderBy: { expiresAt: "asc" },
        take: 1,
      },
    },
  });
  return NextResponse.json(toCompanyDTO(row), { status: 201 });
}
