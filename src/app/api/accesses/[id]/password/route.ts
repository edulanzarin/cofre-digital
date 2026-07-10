import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUnlockedUser, unauthorized, vaultLocked } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// Qualquer setor logado pode copiar a senha (a UI só revela pro Societário).
// Acesso por certificado digital devolve a senha do certificado vinculado.
export async function GET(_req: Request, { params }: Params) {
  const session = await requireUnlockedUser();
  if (!session) return unauthorized();
  if (session === "locked") return vaultLocked();
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
