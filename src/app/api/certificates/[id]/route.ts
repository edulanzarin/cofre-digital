import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CERT_INCLUDE,
  type CertSnapshot,
  certFileBase,
  describeCertChanges,
  parseCertBody,
  resolveCertCompany,
  toDTO,
} from "@/lib/certificate-api";
import { guard } from "@/lib/api-auth";
import { assignCompanyGroup, resolveOwnGroupId } from "@/lib/company-group-assign";
import { fileFieldsFor, loadBytes, removeFileAt } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Certificado não encontrado." }, { status: 404 });

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
  const parsed = parseCertBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const data = parsed.data;
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
        error: `Existe OUTRO certificado idêntico no cofre (${duplicate.holder}, mesmo documento, tipo e vencimento). Provavelmente é um cadastro duplicado: exclua um deles para poder salvar.`,
      },
      { status: 409 },
    );
  }
  // Mesma regra do cadastro: e-CNPJ tem que bater com a empresa vinculada, e
  // trocar por um .pfx de outro CNPJ (ou sem empresa) religa pela regra do CNPJ.
  const resolved = await resolveCertCompany(data);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 409 });
  }
  const company = resolved.company;
  data.companyId = company?.id ?? null;
  // Nome legível "NOME - DOCUMENTO", igual no download e no arquivo físico.
  const fileBase = certFileBase(company?.razaoSocial ?? data.holder, data.document);
  if (data.fileName) data.fileName = `${fileBase}.pfx`;
  // Foto do certificado ANTES da edição — base do histórico "o que mudou". Traz
  // também o nome da empresa dona e do grupo efetivo para o diff sair legível.
  const before = await prisma.certificate.findUnique({
    where: { id },
    select: {
      holder: true,
      document: true,
      type: true,
      media: true,
      issuer: true,
      issuedAt: true,
      expiresAt: true,
      password: true,
      notes: true,
      fileData: true,
      filePath: true,
      groupId: true,
      company: {
        select: { razaoSocial: true, group: { select: { name: true } } },
      },
      group: { select: { name: true } },
    },
  });
  if (!before) return notFound();
  const beforeSnap: CertSnapshot = {
    holder: before.holder,
    document: before.document,
    type: before.type,
    media: before.media,
    issuer: before.issuer,
    issuedAt: before.issuedAt,
    expiresAt: before.expiresAt,
    password: before.password,
    notes: before.notes,
    companyName: before.company?.razaoSocial ?? null,
    groupName: before.company
      ? (before.company.group?.name ?? null)
      : (before.group?.name ?? null),
    hasFile: Boolean(before.fileData || before.filePath),
  };
  // Grupo do certificado: com empresa dona, o grupo é o dela e o direto zera;
  // sem empresa, o grupo mora no cert. Seletor vazio/oculto não mexe no que já
  // havia (nunca desvincula, igual à empresa).
  const rawGroupId = (raw as { groupId?: unknown })?.groupId;
  let groupId: string | null;
  if (company) {
    groupId = null;
  } else if (typeof rawGroupId === "string" && rawGroupId !== "") {
    groupId = (await resolveOwnGroupId(rawGroupId, auth)) ?? before.groupId;
  } else {
    groupId = before.groupId;
  }
  try {
    // Grupo escolhido no formulário entra na empresa dona (nunca desvincula).
    if (company) {
      await assignCompanyGroup(company.id, rawGroupId, auth);
    }
    // Arquivo: cartão nunca tem; com novos bytes, (re)grava; sem bytes num
    // certificado de arquivo, PRESERVA o que já existe (protege contra o disco
    // falhar na hora da edição e apagar a referência sem querer).
    const fileReplaced = data.media === "FILE" && Boolean(data.fileData);
    const file =
      data.media === "CARD"
        ? { base64: null, filePath: null }
        : data.fileData
          ? await fileFieldsFor("certificados", id, data.fileData, "pfx", {
              baseName: fileBase,
              keepPath: before.filePath,
            })
          : { base64: before.fileData, filePath: before.filePath };
    // Atualiza primeiro (sem evento) para o diff comparar contra o estado real
    // já gravado — inclusive o grupo que a empresa acabou de receber.
    const row = await prisma.certificate.update({
      where: { id },
      data: {
        ...data,
        groupId,
        fileData: file.base64,
        filePath: file.filePath,
      },
      include: CERT_INCLUDE,
    });
    const afterSnap: CertSnapshot = {
      holder: row.holder,
      document: row.document,
      type: row.type,
      media: row.media,
      issuer: row.issuer,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      password: row.password,
      notes: row.notes,
      companyName: row.company?.razaoSocial ?? null,
      groupName: row.company
        ? (row.company.group?.name ?? null)
        : (row.group?.name ?? null),
      hasFile: Boolean(row.fileData || row.filePath),
    };
    // Só registra evento quando algo REALMENTE mudou — nada de "atualizado" vazio.
    const changes = describeCertChanges(beforeSnap, afterSnap, { fileReplaced });
    if (changes) {
      await prisma.certificateEvent.create({
        data: { certificateId: id, kind: "updated", message: changes, userName: auth.name },
      });
    }
    // Arquivo que saiu do disco (virou cartão) é removido de lá.
    if (before.filePath && before.filePath !== file.filePath) {
      await removeFileAt(before.filePath);
    }
    return NextResponse.json(toDTO(row, true));
  } catch (err) {
    // Não engolir a causa real (ex.: falha ao gravar na rede): registra no
    // servidor e devolve a mensagem, senão a edição só mostra "não encontrado".
    console.error(`Falha ao salvar certificado ${id}:`, err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Não foi possível salvar: ${err.message}`
            : "Falha ao salvar as alterações.",
      },
      { status: 500 },
    );
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
