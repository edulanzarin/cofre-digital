import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CERT_INCLUDE, parseCertBody, toDTO } from "@/lib/certificate-api";
import { guard } from "@/lib/api-auth";
import { assignCompanyGroup } from "@/lib/company-group-assign";
import { fileFieldsFor, loadBytes, removeFileAt } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Certificado não encontrado." }, { status: 404 });

function companyFileName(razaoSocial: string, document: string): string {
  const digits = document.replace(/\D/g, "");
  // Sufixo do CNPJ: posições 8-11 (4 dígitos). 0001 = matriz, demais = filial.
  const suffix =
    digits.length === 14
      ? digits.slice(8, 12) === "0001"
        ? "_MATRIZ"
        : `_FILIAL_${digits.slice(8, 12)}`
      : "";

  const base = razaoSocial
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return `${base}${suffix}.pfx`;
}

// Com todos os segredos — quem edita (usado pelo modal de edição).
export async function GET(_req: Request, { params }: Params) {
  const auth = await guard("certificados", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.certificate.findUnique({
    where: { id },
    include: CERT_INCLUDE,
  });
  if (!row) return notFound();
  // Se o .pfx vive em disco, traz os bytes para o form de edição enxergar o
  // arquivo do mesmo jeito que quando ele estava no banco.
  if (row.filePath) {
    const bytes = await loadBytes(row.filePath, row.fileData);
    if (bytes) row.fileData = bytes.toString("base64");
  }
  return NextResponse.json(toDTO(row, true));
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await guard("certificados", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const raw = await req.json().catch(() => null);
  const data = parseCertBody(raw);
  if (!data) {
    return NextResponse.json(
      { error: "Dados do certificado inválidos." },
      { status: 400 },
    );
  }
  const duplicate = await prisma.certificate.findFirst({
    where: {
      document: data.document,
      type: data.type,
      expiresAt: data.expiresAt,
      NOT: { id },
    },
    select: { holder: true },
  });
  if (duplicate) {
    return NextResponse.json(
      {
        error: `Existe OUTRO certificado idêntico no cofre (${duplicate.holder} — mesmo documento, tipo e vencimento). Provavelmente é um cadastro duplicado: exclua um deles para poder salvar.`,
      },
      { status: 409 },
    );
  }
  if (data.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { id: true, razaoSocial: true },
    });
    if (!company) {
      data.companyId = null;
    } else if (data.fileName) {
      // Renomeia o .pfx para o nome da empresa ao editar também.
      data.fileName = companyFileName(company.razaoSocial, data.document);
    }
  }
  try {
    const before = await prisma.certificate.findUniqueOrThrow({
      where: { id },
      select: { expiresAt: true, fileData: true, filePath: true },
    });
    const renewed = before.expiresAt.getTime() !== data.expiresAt.getTime();
    // Grupo escolhido no formulário entra na empresa dona (nunca desvincula).
    if (data.companyId) {
      await assignCompanyGroup(data.companyId, (raw as { groupId?: unknown })?.groupId, auth);
    }
    // Arquivo: cartão nunca tem; com novos bytes, (re)grava; sem bytes num
    // certificado de arquivo, PRESERVA o que já existe (protege contra o disco
    // falhar na hora da edição e apagar a referência sem querer).
    const file =
      data.media === "CARD"
        ? { base64: null, filePath: null }
        : data.fileData
          ? await fileFieldsFor("certificados", id, data.fileData, "pfx")
          : { base64: before.fileData, filePath: before.filePath };
    const row = await prisma.certificate.update({
      where: { id },
      data: {
        ...data,
        fileData: file.base64,
        filePath: file.filePath,
        events: {
          create: {
            kind: "updated",
            userName: auth.name,
            message: renewed ? "Novo vencimento registrado." : null,
          },
        },
      },
      include: CERT_INCLUDE,
    });
    // Arquivo que saiu do disco (virou cartão) é removido de lá.
    if (before.filePath && before.filePath !== file.filePath) {
      await removeFileAt(before.filePath);
    }
    return NextResponse.json(toDTO(row, true));
  } catch {
    return notFound();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guard("certificados", "edit");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const gone = await prisma.certificate.delete({
      where: { id },
      select: { filePath: true },
    });
    if (gone.filePath) await removeFileAt(gone.filePath);
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
