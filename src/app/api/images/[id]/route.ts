import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";

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
  return new NextResponse(new Uint8Array(Buffer.from(row.data, "base64")), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
