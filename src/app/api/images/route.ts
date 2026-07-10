import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireEditor } from "@/lib/api-auth";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB por imagem
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Upload de imagem de tutorial (Societário). Corpo: { mime, data(base64) }.
export async function POST(req: Request) {
  if (!(await requireEditor())) return forbidden();
  const body = (await req.json().catch(() => null)) as {
    mime?: string;
    data?: string;
  } | null;

  if (!body?.data || !body.mime || !ALLOWED.includes(body.mime)) {
    return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
  }
  if (Buffer.byteLength(body.data, "utf8") > MAX_BYTES * 1.4) {
    return NextResponse.json(
      { error: "Imagem muito grande (máx. 4 MB)." },
      { status: 400 },
    );
  }

  const row = await prisma.tutorialImage.create({
    data: { mime: body.mime, data: body.data },
  });
  return NextResponse.json({ id: row.id, url: `/api/images/${row.id}` }, { status: 201 });
}
