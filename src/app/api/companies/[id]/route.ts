import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { COMPANY_INCLUDE, parseCompanyBody, toCompanyDTO } from "@/lib/company-api";
import { pruneEmptyGroups } from "@/lib/company-group-prune";

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
  const data = parseCompanyBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json(
      { error: "Informe a razão social e um CNPJ válido (14 dígitos)." },
      { status: 400 },
    );
  }
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
  try {
    const row = await prisma.company.update({
      where: { id },
      data,
      include: COMPANY_INCLUDE,
    });
    // Trocar/limpar o grupo pode ter esvaziado o grupo anterior.
    await pruneEmptyGroups();
    return NextResponse.json(toCompanyDTO(row));
  } catch {
    return notFound();
  }
}

// Excluir a empresa não apaga certificados nem acessos: eles ficam
// no cofre geral, sem vínculo (companyId vira null).
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guard("empresas", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await prisma.company.delete({ where: { id } });
    // A empresa era a última do grupo? Então o grupo some junto.
    await pruneEmptyGroups();
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
