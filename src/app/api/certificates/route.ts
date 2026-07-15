import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CERT_INCLUDE, parseCertBody, toDTO } from "@/lib/certificate-api";
import { guard } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await guard("certificados", "view");
  if (auth instanceof NextResponse) return auth;
  const companyId = new URL(req.url).searchParams.get("companyId");
  const rows = await prisma.certificate.findMany({
    where: companyId ? { companyId } : undefined,
    orderBy: { expiresAt: "asc" },
    include: CERT_INCLUDE,
  });
  return NextResponse.json(rows.map((r) => toDTO(r)));
}

// e-CNPJ sem empresa escolhida entra no cofre da empresa dona do CNPJ
// (criando a empresa na hora, se for a primeira vez).
async function resolveCompanyId(data: {
  companyId: string | null;
  document: string;
  holder: string;
}): Promise<string | null> {
  if (data.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { id: true },
    });
    return company ? company.id : null;
  }
  const digits = data.document.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  const company = await prisma.company.upsert({
    where: { cnpj: digits },
    update: {},
    create: { cnpj: digits, razaoSocial: data.holder },
    select: { id: true },
  });
  return company.id;
}

export async function POST(req: Request) {
  const auth = await guard("certificados", "edit");
  if (auth instanceof NextResponse) return auth;
  const data = parseCertBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json(
      { error: "Dados do certificado inválidos." },
      { status: 400 },
    );
  }
  // Mesmo documento, tipo e vencimento = mesmo certificado físico.
  const duplicate = await prisma.certificate.findFirst({
    where: { document: data.document, type: data.type, expiresAt: data.expiresAt },
    select: { holder: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `Este certificado já está no cofre (${duplicate.holder}).` },
      { status: 409 },
    );
  }
  const companyId = await resolveCompanyId(data);
  const row = await prisma.certificate.create({
    data: {
      ...data,
      companyId,
      events: { create: { kind: "created", userName: auth.name } },
    },
    include: CERT_INCLUDE,
  });
  return NextResponse.json(toDTO(row, true), { status: 201 });
}
