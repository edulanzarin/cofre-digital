// Armazenamento de arquivos em disco (pasta na rede), fora do Postgres.
//
// O banco guarda dado estruturado; o binário (o .pfx do certificado, o PDF do
// alvará, a imagem de print do tutorial) mora numa pasta raiz configurável —
// tipicamente um compartilhamento de rede montado no container. Enquanto a raiz
// não é definida, tudo continua no banco (base64) como antes: o recurso é
// opt-in e não quebra o que já existe.
//
// Só é chamado do servidor (route handlers). O caminho gravado no banco é
// sempre relativo à raiz, então trocar a raiz de lugar não invalida os
// registros.

import { mkdir, readFile as fsReadFile, rm, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";

export type StorageCategory = "certificados" | "alvaras" | "prints";

// Extensão a partir do mime das imagens de print (o resto tem extensão fixa).
export const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function getStorageRoot(): Promise<string | null> {
  const config = await prisma.vaultConfig.findUnique({
    where: { id: 1 },
    select: { storageRoot: true },
  });
  const root = config?.storageRoot?.trim();
  return root ? root : null;
}

// Resolve um caminho relativo dentro da raiz, barrando escapar dela (../).
function resolveInRoot(root: string, relPath: string): string {
  const full = path.resolve(root, relPath);
  const base = path.resolve(root);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error("Caminho de arquivo fora da pasta raiz.");
  }
  return full;
}

// Grava o binário e devolve o caminho RELATIVO à raiz (o que vai pro banco).
// `id` é sempre um uuid nosso, então o nome do arquivo não vem do usuário.
export async function saveFile(
  category: StorageCategory,
  id: string,
  ext: string,
  bytes: Buffer,
): Promise<string> {
  const root = await getStorageRoot();
  if (!root) throw new Error("Pasta de arquivos não configurada.");
  const relPath = `${category}/${id}.${ext}`;
  const full = resolveInRoot(root, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return relPath;
}

// Lê o binário pelo caminho relativo. Devolve null se a raiz sumiu ou o
// arquivo não está lá — quem chama decide se cai pro banco como reserva.
export async function readFileAt(relPath: string): Promise<Buffer | null> {
  const root = await getStorageRoot();
  if (!root) return null;
  try {
    return await fsReadFile(resolveInRoot(root, relPath));
  } catch {
    return null;
  }
}

// Remove o arquivo do disco — melhor esforço, nunca derruba a operação.
export async function removeFileAt(relPath: string): Promise<void> {
  const root = await getStorageRoot();
  if (!root) return;
  try {
    await rm(resolveInRoot(root, relPath), { force: true });
  } catch {
    // ignora: o registro do banco some de qualquer forma
  }
}

// Lê o binário de um registro: disco primeiro (se tem filePath), banco como
// reserva (base64). É o que mantém os arquivos antigos servindo enquanto não
// são migrados, e sobrevive à raiz sumir por um instante.
export async function loadBytes(
  filePath: string | null,
  dbBase64: string | null,
): Promise<Buffer | null> {
  if (filePath) {
    const bytes = await readFileAt(filePath);
    if (bytes) return bytes;
  }
  if (dbBase64) return Buffer.from(dbBase64, "base64");
  return null;
}

// Decide onde o binário vai ser gravado: se há pasta configurada, grava em
// disco e devolve o caminho (banco fica null); senão, mantém no banco (base64).
// `id` é o uuid do registro — o nome do arquivo nunca vem do usuário.
export async function fileFieldsFor(
  category: StorageCategory,
  id: string,
  base64: string | null,
  ext: string,
): Promise<{ base64: string | null; filePath: string | null }> {
  if (!base64) return { base64: null, filePath: null };
  const root = await getStorageRoot();
  if (!root) return { base64, filePath: null };
  const filePath = await saveFile(category, id, ext, Buffer.from(base64, "base64"));
  return { base64: null, filePath };
}

// Confere se a pasta serve de raiz: existe (ou pode ser criada) e é gravável.
// Usado ao definir/alterar a pasta, para não guardar um caminho que não presta.
export async function validateStorageDir(
  dir: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = dir.trim();
  if (!clean) return { ok: false, error: "Informe o caminho da pasta." };
  if (!path.isAbsolute(clean)) {
    return { ok: false, error: "Use um caminho absoluto (a partir da raiz)." };
  }
  try {
    await mkdir(clean, { recursive: true });
    await access(clean, constants.W_OK);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "A pasta não existe e não pôde ser criada, ou não é gravável.",
    };
  }
}
