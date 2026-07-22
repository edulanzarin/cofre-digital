import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api-auth";
import { getStorageRoot, saveFile, IMAGE_EXT } from "@/lib/storage";

// Move para a pasta os arquivos que ainda estão no banco (base64). Só admin, e
// só quando a pasta já está definida. Roda sob demanda (botão) — nunca sozinho.
//
// É seguro repetir e seguro parar no meio: cada registro só tem o base64
// zerado DEPOIS de o arquivo estar gravado em disco, e a leitura cai pro banco
// enquanto um registro não migrou. Quem já está em disco (filePath) é ignorado.
export async function POST() {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;

  const root = await getStorageRoot();
  if (!root) {
    return NextResponse.json(
      { error: "Defina a pasta antes de migrar." },
      { status: 400 },
    );
  }

  let certificados = 0;
  let alvaras = 0;
  let prints = 0;

  const certs = await prisma.certificate.findMany({
    where: { fileData: { not: null }, filePath: null },
    select: { id: true, fileData: true },
  });
  for (const c of certs) {
    if (!c.fileData) continue;
    const filePath = await saveFile("certificados", c.id, "pfx", Buffer.from(c.fileData, "base64"));
    await prisma.certificate.update({
      where: { id: c.id },
      data: { filePath, fileData: null },
    });
    certificados++;
  }

  const alv = await prisma.alvara.findMany({
    where: { fileData: { not: null }, filePath: null },
    select: { id: true, fileData: true },
  });
  for (const a of alv) {
    if (!a.fileData) continue;
    const filePath = await saveFile("alvaras", a.id, "pdf", Buffer.from(a.fileData, "base64"));
    await prisma.alvara.update({
      where: { id: a.id },
      data: { filePath, fileData: null },
    });
    alvaras++;
  }

  const imgs = await prisma.tutorialImage.findMany({
    where: { data: { not: null }, filePath: null },
    select: { id: true, mime: true, data: true },
  });
  for (const img of imgs) {
    if (!img.data) continue;
    const ext = IMAGE_EXT[img.mime] ?? "bin";
    const filePath = await saveFile("prints", img.id, ext, Buffer.from(img.data, "base64"));
    await prisma.tutorialImage.update({
      where: { id: img.id },
      data: { filePath, data: null },
    });
    prints++;
  }

  return NextResponse.json({ certificados, alvaras, prints });
}
