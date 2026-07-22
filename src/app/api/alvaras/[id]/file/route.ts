import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { loadBytes } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

// PDF do alvará — quem enxerga alvarás. `inline` abre direto no
// navegador; o botão "Baixar" usa o atributo download do link.
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("alvaras", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.alvara.findUnique({
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
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${row.fileName ?? "alvara.pdf"}"`,
    },
  });
}
