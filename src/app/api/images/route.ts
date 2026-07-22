import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { fileFieldsFor, IMAGE_EXT } from "@/lib/storage";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB por imagem
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Upload de imagem de tutorial (quem edita acessos). Corpo: { mime, data(base64) }.
export async function POST(req: Request) {
  const auth = await guard("acessos", "edit");
  if (auth instanceof NextResponse) return auth;
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

  // Com pasta configurada, a imagem vai pro disco; senão, fica no banco.
  const id = randomUUID();
  const file = await fileFieldsFor("prints", id, body.data, IMAGE_EXT[body.mime]);
  const row = await prisma.tutorialImage.create({
    data: { id, mime: body.mime, data: file.base64, filePath: file.filePath },
  });
  return NextResponse.json({ id: row.id, url: `/api/images/${row.id}` }, { status: 201 });
}
