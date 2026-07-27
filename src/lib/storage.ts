// Armazenamento dos binários (o .pfx do certificado, o PDF do alvará, a imagem
// de print) FORA do Postgres. Dois destinos possíveis:
//
//  - Rede (SMB): se as variáveis SMB_* existem, grava direto no compartilhamento
//    via smbclient (ver smb.ts). É o modo de produção — o arquivo mora no
//    \\servidor\share, nunca dentro do container.
//  - Disco local: senão, usa uma pasta raiz configurada (VaultConfig.storageRoot).
//    Sem nenhum dos dois, tudo fica no banco (base64) como antes — opt-in, não
//    quebra o que já existe.
//
// Só é chamado do servidor (route handlers). O caminho gravado no banco é sempre
// relativo à raiz/base, então trocar o destino de lugar não invalida os
// registros.

import { mkdir, readFile as fsReadFile, rm, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";
import {
  smbConfig,
  smbDisplayPath,
  smbExists,
  smbRead,
  smbRemove,
  smbWrite,
} from "./smb";

export type StorageCategory = "certificados" | "alvaras" | "prints";

// Extensão a partir do mime das imagens de print (o resto tem extensão fixa).
export const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Pasta raiz LOCAL (quando não é SMB): vem do banco. null = não configurada.
async function fsRoot(): Promise<string | null> {
  const config = await prisma.vaultConfig.findUnique({
    where: { id: 1 },
    select: { storageRoot: true },
  });
  const root = config?.storageRoot?.trim();
  return root ? root : null;
}

// Há armazenamento externo (fora do banco)? Devolve um rótulo do destino (a rede
// ou o caminho local) ou null. É o que decide gravar em arquivo vs. no banco, e
// o que a tela de Configurações mostra.
export async function getStorageRoot(): Promise<string | null> {
  const cfg = smbConfig();
  if (cfg) return smbDisplayPath(cfg);
  return fsRoot();
}

// Resolve um caminho relativo dentro da raiz local, barrando escapar dela (../).
function resolveInRoot(root: string, relPath: string): string {
  const full = path.resolve(root, relPath);
  const base = path.resolve(root);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error("Caminho de arquivo fora da pasta raiz.");
  }
  return full;
}

export type FileNameOpts = {
  // Nome legível do arquivo (sem extensão), ex.: "EMPRESA X - 12345678000199".
  // Sem isso, o nome no destino é o uuid do registro (nome técnico).
  baseName?: string;
  // Caminho atual do próprio registro: pode ser sobrescrito sem virar "(2)".
  keepPath?: string | null;
};

// Escolhe o caminho relativo do arquivo. Com baseName, usa o nome legível e acha
// um livre para NUNCA sobrescrever o arquivo de outro registro ("NOME (2).pfx");
// o do próprio registro (keepPath) é reaproveitado. Sem baseName, usa o uuid.
// `exists` diz se um candidato já ocupa o destino (disco ou rede).
async function pickRelPath(
  category: StorageCategory,
  id: string,
  ext: string,
  opts: FileNameOpts | undefined,
  exists: (relPath: string) => Promise<boolean>,
): Promise<string> {
  const base = opts?.baseName?.replace(/[\\/]/g, "").trim();
  if (!base) return `${category}/${id}.${ext}`;
  let candidate = `${category}/${base}.${ext}`;
  for (let i = 2; ; i++) {
    if (candidate === opts?.keepPath) return candidate;
    if (!(await exists(candidate))) return candidate;
    candidate = `${category}/${base} (${i}).${ext}`;
  }
}

// Grava o binário e devolve o caminho RELATIVO à raiz/base (o que vai pro banco).
export async function saveFile(
  category: StorageCategory,
  id: string,
  ext: string,
  bytes: Buffer,
  opts?: FileNameOpts,
): Promise<string> {
  const cfg = smbConfig();
  if (cfg) {
    const relPath = await pickRelPath(category, id, ext, opts, (p) =>
      smbExists(cfg, p),
    );
    await smbWrite(cfg, relPath, bytes);
    return relPath;
  }
  const root = await fsRoot();
  if (!root) throw new Error("Pasta de arquivos não configurada.");
  const relPath = await pickRelPath(category, id, ext, opts, async (p) => {
    try {
      await access(resolveInRoot(root, p));
      return true;
    } catch {
      return false;
    }
  });
  const full = resolveInRoot(root, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return relPath;
}

// Lê o binário pelo caminho relativo. Devolve null se o destino sumiu ou o
// arquivo não está lá — quem chama decide se cai pro banco como reserva.
export async function readFileAt(relPath: string): Promise<Buffer | null> {
  const cfg = smbConfig();
  if (cfg) return smbRead(cfg, relPath);
  const root = await fsRoot();
  if (!root) return null;
  try {
    return await fsReadFile(resolveInRoot(root, relPath));
  } catch {
    return null;
  }
}

// Remove o arquivo do destino — melhor esforço, nunca derruba a operação.
export async function removeFileAt(relPath: string): Promise<void> {
  const cfg = smbConfig();
  if (cfg) {
    await smbRemove(cfg, relPath);
    return;
  }
  const root = await fsRoot();
  if (!root) return;
  try {
    await rm(resolveInRoot(root, relPath), { force: true });
  } catch {
    // ignora: o registro do banco some de qualquer forma
  }
}

// Lê o binário de um registro: destino primeiro (se tem filePath), banco como
// reserva (base64). É o que mantém os arquivos antigos servindo enquanto não
// são migrados, e sobrevive ao destino sumir por um instante.
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

// Decide onde o binário vai ser gravado: se há destino configurado, grava lá e
// devolve o caminho (banco fica null); senão, mantém no banco (base64).
// `id` é o uuid do registro — usado como nome técnico quando não há baseName.
export async function fileFieldsFor(
  category: StorageCategory,
  id: string,
  base64: string | null,
  ext: string,
  opts?: FileNameOpts,
): Promise<{ base64: string | null; filePath: string | null }> {
  if (!base64) return { base64: null, filePath: null };
  const root = await getStorageRoot();
  if (!root) return { base64, filePath: null };
  const filePath = await saveFile(category, id, ext, Buffer.from(base64, "base64"), opts);
  return { base64: null, filePath };
}

// Confere se a pasta LOCAL serve de raiz: existe (ou pode ser criada) e é
// gravável. Usado só no modo de pasta local (não SMB).
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
