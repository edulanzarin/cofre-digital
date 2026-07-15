import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACCESS_INCLUDE,
  findDuplicateUrl,
  parseAccessBody,
  toAccessDTO,
} from "@/lib/access-api";
import { guard } from "@/lib/api-auth";
import { allows } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });

// Detalhe com tutorial para quem vê; senha só para quem edita.
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("acessos", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.access.findUnique({
    where: { id },
    include: ACCESS_INCLUDE,
  });
  if (!row) return notFound();
  return NextResponse.json(
    toAccessDTO(row, { tutorial: true, secrets: allows(auth, "acessos", "edit") }),
  );
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await guard("acessos", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
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
  const duplicate = await findDuplicateUrl(data.url, id);
  if (duplicate) {
    return NextResponse.json(
      { error: `Já existe um acesso com este link (${duplicate.name}).` },
      { status: 409 },
    );
  }
  try {
    const row = await prisma.access.update({
      where: { id },
      data,
      include: ACCESS_INCLUDE,
    });
    return NextResponse.json(toAccessDTO(row, { tutorial: true, secrets: true }));
  } catch {
    return notFound();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guard("acessos", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await prisma.access.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
