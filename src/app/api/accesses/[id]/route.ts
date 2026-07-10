import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACCESS_INCLUDE,
  findDuplicateUrl,
  parseAccessBody,
  toAccessDTO,
} from "@/lib/access-api";
import {
  forbidden,
  requireEditor,
  requireUnlockedUser,
  unauthorized,
  vaultLocked,
} from "@/lib/api-auth";
import { isEditor } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });

// Detalhe com tutorial para todos; senha só para o Societário.
export async function GET(_req: Request, { params }: Params) {
  const session = await requireUnlockedUser();
  if (!session) return unauthorized();
  if (session === "locked") return vaultLocked();
  const { id } = await params;
  const row = await prisma.access.findUnique({
    where: { id },
    include: ACCESS_INCLUDE,
  });
  if (!row) return notFound();
  return NextResponse.json(
    toAccessDTO(row, { tutorial: true, secrets: isEditor(session) }),
  );
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await requireEditor())) return forbidden();
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
  if (!(await requireEditor())) return forbidden();
  const { id } = await params;
  try {
    await prisma.access.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
