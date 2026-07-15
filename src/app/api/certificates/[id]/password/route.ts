import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// Quem enxerga certificados pode copiar a senha (a UI só revela pra quem edita).
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("certificados", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.certificate.findUnique({
    where: { id },
    select: { password: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Certificado não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ password: row.password });
}
