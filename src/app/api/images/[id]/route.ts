import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { loadBytes } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

// Imagem de tutorial — quem enxerga acessos.
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("acessos", "view");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.tutorialImage.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }
  // Disco primeiro (se está lá), banco como reserva.
  const bytes = await loadBytes(row.filePath, row.data);
  if (!bytes) {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
