import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

function toDTO(row: {
  id: string;
  kind: string;
  message: string | null;
  userName: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    kind: row.kind,
    message: row.message ?? undefined,
    userName: row.userName,
    createdAt: row.createdAt.toISOString(),
  };
}

// Linha do tempo do certificado — quem vê certificados acompanha.
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("certificados", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const rows = await prisma.certificateEvent.findMany({
    where: { certificateId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(toDTO));
}

// Observação manual ("solicitado renovação", "cliente avisado"…).
// Qualquer setor que enxerga o certificado pode anotar.
export async function POST(req: Request, { params }: Params) {
  const auth = await guard("certificados", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Escreva a observação." }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Observação muito longa (máx. 2000 caracteres)." },
      { status: 400 },
    );
  }
  const cert = await prisma.certificate.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!cert) {
    return NextResponse.json(
      { error: "Certificado não encontrado." },
      { status: 404 },
    );
  }
  const row = await prisma.certificateEvent.create({
    data: { certificateId: id, kind: "note", message, userName: auth.name },
  });
  return NextResponse.json(toDTO(row), { status: 201 });
}
