import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import {
  COMPANY_INCLUDE,
  describeCompanyCreation,
  parseCompanyBody,
  toCompanyDTO,
} from "@/lib/company-api";

export async function GET() {
  const auth = await guard("empresas", "view");
  if (auth instanceof NextResponse) return auth;
  const rows = await prisma.company.findMany({
    orderBy: { razaoSocial: "asc" },
    include: COMPANY_INCLUDE,
  });
  return NextResponse.json(rows.map(toCompanyDTO));
}

export async function POST(req: Request) {
  const auth = await guard("empresas", "edit");
  if (auth instanceof NextResponse) return auth;
  const parsed = parseCompanyBody(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const data = parsed.data;
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
    include: COMPANY_INCLUDE,
  });
  await prisma.companyEvent.create({
    data: {
      companyId: row.id,
      kind: "created",
      message: describeCompanyCreation(data),
      userName: auth.name,
    },
  });
  return NextResponse.json(toCompanyDTO(row), { status: 201 });
}
