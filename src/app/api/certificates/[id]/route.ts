import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CERT_INCLUDE, parseCertBody, toDTO } from "@/lib/certificate-api";
import { guard } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Certificado não encontrado." }, { status: 404 });

// Com todos os segredos — quem edita (usado pelo modal de edição).
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("certificados", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.certificate.findUnique({
    where: { id },
    include: CERT_INCLUDE,
  });
  if (!row) return notFound();
  return NextResponse.json(toDTO(row, true));
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await guard("certificados", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const data = parseCertBody(await req.json().catch(() => null));
  if (!data) {
    return NextResponse.json(
      { error: "Dados do certificado inválidos." },
      { status: 400 },
    );
  }
  const duplicate = await prisma.certificate.findFirst({
    where: {
      document: data.document,
      type: data.type,
      expiresAt: data.expiresAt,
      NOT: { id },
    },
    select: { holder: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `Este certificado já está no cofre (${duplicate.holder}).` },
      { status: 409 },
    );
  }
  if (data.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { id: true },
    });
    if (!company) data.companyId = null;
  }
  try {
    const before = await prisma.certificate.findUniqueOrThrow({
      where: { id },
      select: { expiresAt: true },
    });
    const renewed = before.expiresAt.getTime() !== data.expiresAt.getTime();
    const row = await prisma.certificate.update({
      where: { id },
      data: {
        ...data,
        events: {
          create: {
            kind: "updated",
            userName: auth.name,
            message: renewed ? "Novo vencimento registrado." : null,
          },
        },
      },
      include: CERT_INCLUDE,
    });
    return NextResponse.json(toDTO(row, true));
  } catch {
    return notFound();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guard("certificados", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await prisma.certificate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
