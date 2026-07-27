import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { CERT_INCLUDE, certFileBase, parseCertBody, toDTO } from "@/lib/certificate-api";
import { guard } from "@/lib/api-auth";
import { assignCompanyGroup } from "@/lib/company-group-assign";
import { fileFieldsFor } from "@/lib/storage";

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
async function resolveCompany(data: {
  companyId: string | null;
  document: string;
  holder: string;
}): Promise<{ id: string; razaoSocial: string } | null> {
  if (data.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { id: true, razaoSocial: true },
    });
    return company ?? null;
  }
  const digits = data.document.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  const company = await prisma.company.upsert({
    where: { cnpj: digits },
    update: {},
    create: { cnpj: digits, razaoSocial: data.holder },
    select: { id: true, razaoSocial: true },
  });
  return company;
}

export async function POST(req: Request) {
  const auth = await guard("certificados", "edit");
  if (auth instanceof NextResponse) return auth;
  const raw = await req.json().catch(() => null);
  const data = parseCertBody(raw);
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
  const company = await resolveCompany(data);
  // Nome legível "NOME - DOCUMENTO" (empresa e CNPJ, ou titular e CPF). Vale
  // tanto para o download quanto para o arquivo físico no disco.
  const fileBase = certFileBase(company?.razaoSocial ?? data.holder, data.document);
  if (data.fileName) data.fileName = `${fileBase}.pfx`;
  // Grupo escolhido no formulário entra na empresa dona — feito antes de criar
  // o certificado para o include já trazer o nome do grupo na resposta.
  if (company) {
    await assignCompanyGroup(company.id, (raw as { groupId?: unknown })?.groupId, auth);
  }
  // Com pasta configurada, o .pfx vai pro disco; senão, fica no banco (base64).
  const id = randomUUID();
  const file = await fileFieldsFor("certificados", id, data.fileData, "pfx", {
    baseName: fileBase,
  });
  const row = await prisma.certificate.create({
    data: {
      id,
      ...data,
      fileData: file.base64,
      filePath: file.filePath,
      companyId: company?.id ?? null,
      events: { create: { kind: "created", userName: auth.name } },
    },
    include: CERT_INCLUDE,
  });
  return NextResponse.json(toDTO(row, true), { status: 201 });
}
