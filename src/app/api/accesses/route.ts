import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACCESS_INCLUDE,
  findDuplicateUrl,
  parseAccessBody,
  toAccessDTO,
} from "@/lib/access-api";
import { guard } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await guard("acessos", "view");
  if (auth instanceof NextResponse) return auth;
  const companyId = new URL(req.url).searchParams.get("companyId");
  const rows = await prisma.access.findMany({
    where: companyId ? { companyId } : undefined,
    orderBy: { name: "asc" },
    include: ACCESS_INCLUDE,
  });
  return NextResponse.json(rows.map((r) => toAccessDTO(r)));
}

export async function POST(req: Request) {
  const auth = await guard("acessos", "edit");
  if (auth instanceof NextResponse) return auth;
  const data = parseAccessBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json({ error: "Dados do acesso inválidos." }, { status: 400 });
  }
  if (data.certificateId) {
    const cert = await prisma.certificate.findUnique({
      where: { id: data.certificateId },
      select: { id: true },
    });
    if (!cert) {
      return NextResponse.json(
        { error: "Certificado vinculado não encontrado." },
        { status: 400 },
      );
    }
  }
  if (data.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { id: true },
    });
    if (!company) data.companyId = null;
  }
  const duplicate = await findDuplicateUrl(data.url);
  if (duplicate) {
    return NextResponse.json(
      { error: `Já existe um acesso com este link (${duplicate.name}).` },
      { status: 409 },
    );
  }
  const row = await prisma.access.create({ data, include: ACCESS_INCLUDE });
  return NextResponse.json(toAccessDTO(row, { tutorial: true, secrets: true }), {
    status: 201,
  });
}
