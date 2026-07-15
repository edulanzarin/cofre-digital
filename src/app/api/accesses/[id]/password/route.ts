import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// Quem enxerga acessos pode copiar a senha (a UI só revela pra quem edita).
// Acesso por certificado digital devolve a senha do certificado vinculado.
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("acessos", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.access.findUnique({
    where: { id },
    select: {
      password: true,
      certificate: { select: { password: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
  }
  return NextResponse.json({
    password: row.certificate?.password ?? row.password,
  });
}
