import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCertBody, toDTO } from "@/lib/certificate-api";
import {
  forbidden,
  requireEditor,
  requireUnlockedUser,
  unauthorized,
  vaultLocked,
} from "@/lib/api-auth";

export async function GET() {
  const session = await requireUnlockedUser();
  if (!session) return unauthorized();
  if (session === "locked") return vaultLocked();
  const rows = await prisma.certificate.findMany({
    orderBy: { expiresAt: "asc" },
  });
  return NextResponse.json(rows.map((r) => toDTO(r)));
}

export async function POST(req: Request) {
  if (!(await requireEditor())) return forbidden();
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
  const row = await prisma.certificate.create({ data });
  return NextResponse.json(toDTO(row, true), { status: 201 });
}
