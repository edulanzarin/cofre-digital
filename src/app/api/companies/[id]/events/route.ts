import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { toCompanyEventDTO } from "@/lib/company-event-api";

type Params = { params: Promise<{ id: string }> };

// Linha do tempo da empresa — quem enxerga a empresa acompanha.
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("empresas", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const rows = await prisma.companyEvent.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(toCompanyEventDTO));
}

// Recado da equipe ("alvará solicitado dia 3 para o cliente"). Quem só
// visualiza também anota: quem acompanha o cliente nem sempre é quem edita
// o cadastro dele.
export async function POST(req: Request, { params }: Params) {
  const auth = await guard("empresas", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    message?: string;
    pinned?: boolean;
  } | null;
  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Escreva a anotação." }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Anotação muito longa (máx. 2000 caracteres)." },
      { status: 400 },
    );
  }
  const company = await prisma.company.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }
  const row = await prisma.companyEvent.create({
    data: {
      companyId: id,
      kind: "note",
      message,
      pinned: body?.pinned === true,
      userName: auth.name,
    },
  });
  return NextResponse.json(toCompanyEventDTO(row), { status: 201 });
}
