import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUnlockedUser, unauthorized, vaultLocked } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await requireUnlockedUser();
  if (!session) return unauthorized();
  if (session === "locked") return vaultLocked();
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
