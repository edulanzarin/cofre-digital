import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import {
  COMPANY_INCLUDE,
  companySnapshot,
  describeCompanyChanges,
  parseCompanyBody,
  toCompanyDTO,
} from "@/lib/company-api";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("empresas", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.company.findUnique({
    where: { id },
    include: COMPANY_INCLUDE,
  });
  if (!row) return notFound();
  return NextResponse.json(toCompanyDTO(row));
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await guard("empresas", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = parseCompanyBody(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const data = parsed.data;
  const duplicate = await prisma.company.findFirst({
    where: { cnpj: data.cnpj, NOT: { id } },
    select: { razaoSocial: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `Este CNPJ já está cadastrado (${duplicate.razaoSocial}).` },
      { status: 409 },
    );
  }
  // Estado de antes para o histórico contar o que mudou — e não um
  // "dados atualizados" que não diz nada a quem cobra honorário.
  const before = await prisma.company.findUnique({
    where: { id },
    include: { group: { select: { name: true } } },
  });
  if (!before) return notFound();
  try {
    const row = await prisma.company.update({
      where: { id },
      data,
      include: COMPANY_INCLUDE,
    });
    const changes = describeCompanyChanges(
      companySnapshot(before),
      companySnapshot(row),
    );
    if (changes) {
      await prisma.companyEvent.create({
        data: { companyId: id, kind: "updated", message: changes, userName: auth.name },
      });
    }
    return NextResponse.json(toCompanyDTO(row));
  } catch {
    return notFound();
  }
}

// Excluir a empresa não apaga certificados nem acessos: eles ficam
// no cofre geral, sem vínculo (companyId vira null). As anotações vão
// junto — sem a empresa, o recado não tem a quem se referir.
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guard("empresas", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
