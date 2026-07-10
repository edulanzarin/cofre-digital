import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUnlockedUser, unauthorized, vaultLocked } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// Download do .pfx — qualquer setor logado.
export async function GET(_req: Request, { params }: Params) {
  const session = await requireUnlockedUser();
  if (!session) return unauthorized();
  if (session === "locked") return vaultLocked();
  const { id } = await params;
  const row = await prisma.certificate.findUnique({
    where: { id },
    select: { fileName: true, fileData: true },
  });
  if (!row?.fileData) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
  const bytes = Buffer.from(row.fileData, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/x-pkcs12",
      "Content-Disposition": `attachment; filename="${row.fileName ?? "certificado.pfx"}"`,
    },
  });
}
