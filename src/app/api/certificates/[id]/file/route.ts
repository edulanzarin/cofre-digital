import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { loadBytes } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

// Download do .pfx — quem enxerga certificados.
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("certificados", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.certificate.findUnique({
    where: { id },
    select: { fileName: true, fileData: true, filePath: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
  // Disco primeiro (se está lá), banco como reserva.
  const bytes = await loadBytes(row.filePath, row.fileData);
  if (!bytes) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/x-pkcs12",
      "Content-Disposition": `attachment; filename="${row.fileName ?? "certificado.pfx"}"`,
    },
  });
}
