// Armazenamento dos binários (o .pfx do certificado, o PDF do alvará, a imagem
// de print) FORA do Postgres. Dois destinos possíveis:
//
//  - Rede (SMB): se as variáveis SMB_* existem, grava direto no compartilhamento
//    via smbclient (ver smb.ts). É o modo de produção.
//  - Disco local: senão, usa uma pasta raiz local (VaultConfig.storageRoot).
//    Sem nenhum dos dois, tudo fica no banco (base64) como antes.
//
// A pasta-base do cofre tem um PADRÃO (env SMB_BASE_PATH / pasta local) que um
// admin pode SOBRESCREVER em Configurações; o valor escolhido fica em
// VaultConfig.storageRoot. O caminho gravado no banco por arquivo é sempre
// relativo à base, então mudar a base de lugar (movendo os arquivos junto) não
// invalida os registros. Só roda no servidor.

import { mkdir, readFile as fsReadFile, rm, rename, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";
import {
  normRel,
  smbConfig,
  smbDirExists,
  smbDisplayPath,
  smbExists,
  smbListDirs,
  smbRead,
  smbRemove,
  smbRename,
  smbWrite,
  type SmbConfig,
} from "./smb";

export type StorageCategory = "certificados" | "alvaras" | "prints";

// Extensão a partir do mime das imagens de print (o resto tem extensão fixa).
export const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Override da pasta escolhido por um admin (VaultConfig.storageRoot). Vale como
// pasta LOCAL (modo disco) ou como base relativa ao share (modo SMB). null = usa
// o padrão.
async function storedRoot(): Promise<string | null> {
  const config = await prisma.vaultConfig.findUnique({
    where: { id: 1 },
    select: { storageRoot: true },
  });
  const root = config?.storageRoot?.trim();
  return root ? root : null;
}

// Base efetiva no share (SMB): override do banco ou o padrão do .env.
async function smbBase(cfg: SmbConfig): Promise<string> {
  const override = await storedRoot();
  return override ? normRel(override) : cfg.basePath;
}

function joinBase(base: string, rel: string): string {
  return base ? `${base}/${rel}` : rel;
}

// Há armazenamento externo (fora do banco)? Devolve um rótulo do destino (a rede
// ou o caminho local) ou null. Decide gravar em arquivo vs. no banco, e é o que
// a tela de Configurações mostra.
export async function getStorageRoot(): Promise<string | null> {
  const cfg = smbConfig();
  if (cfg) return smbDisplayPath(cfg, await smbBase(cfg));
  return storedRoot();
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

// Grava o binário e devolve o caminho RELATIVO à base (o que vai pro banco).
export async function saveFile(
  category: StorageCategory,
  id: string,
  ext: string,
  bytes: Buffer,
  opts?: FileNameOpts,
): Promise<string> {
  const cfg = smbConfig();
  if (cfg) {
    const base = await smbBase(cfg);
    const relPath = await pickRelPath(category, id, ext, opts, (p) =>
      smbExists(cfg, joinBase(base, p)),
    );
    await smbWrite(cfg, joinBase(base, relPath), bytes);
    return relPath;
  }
  const root = await storedRoot();
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
  if (cfg) return smbRead(cfg, joinBase(await smbBase(cfg), relPath));
  const root = await storedRoot();
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
    await smbRemove(cfg, joinBase(await smbBase(cfg), relPath));
    return;
  }
  const root = await storedRoot();
  if (!root) return;
  try {
    await rm(resolveInRoot(root, relPath), { force: true });
  } catch {
    // ignora: o registro do banco some de qualquer forma
  }
}

// Lê o binário de um registro: destino primeiro (se tem filePath), banco como
// reserva (base64). Mantém os arquivos antigos servindo enquanto não migram.
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

// Todos os caminhos de arquivo (relativos à base) que estão em disco/rede.
async function allFilePaths(): Promise<string[]> {
  const [certs, alv, imgs] = await Promise.all([
    prisma.certificate.findMany({ where: { filePath: { not: null } }, select: { filePath: true } }),
    prisma.alvara.findMany({ where: { filePath: { not: null } }, select: { filePath: true } }),
    prisma.tutorialImage.findMany({ where: { filePath: { not: null } }, select: { filePath: true } }),
  ]);
  return [...certs, ...alv, ...imgs]
    .map((r) => r.filePath)
    .filter((p): p is string => Boolean(p));
}

// Valida um destino escolhido pelo admin (antes de trocar). SMB: a pasta existe
// no share? Local: existe/é gravável?
export async function validateStoragePath(
  dir: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = smbConfig();
  if (cfg) {
    const rel = normRel(dir);
    if (!rel) return { ok: false, error: "Escolha uma pasta na rede." };
    return (await smbDirExists(cfg, rel))
      ? { ok: true }
      : { ok: false, error: "Pasta não encontrada na rede." };
  }
  return validateStorageDir(dir);
}

// Troca a pasta-base e MOVE os arquivos existentes da base antiga para a nova
// (os filePath do banco são relativos à base, então a estrutura se mantém).
// Devolve quantos foram movidos e quantos falharam.
export async function changeStorage(
  dir: string,
): Promise<{ moved: number; failed: number }> {
  const cfg = smbConfig();
  if (cfg) {
    const oldBase = await smbBase(cfg);
    const newBase = normRel(dir);
    let moved = 0;
    let failed = 0;
    if (oldBase !== newBase) {
      for (const fp of await allFilePaths()) {
        try {
          await smbRename(cfg, joinBase(oldBase, fp), joinBase(newBase, fp));
          moved++;
        } catch {
          failed++;
        }
      }
    }
    await prisma.vaultConfig.upsert({
      where: { id: 1 },
      update: { storageRoot: newBase },
      create: { id: 1, storageRoot: newBase },
    });
    return { moved, failed };
  }

  const oldRoot = await storedRoot();
  const newRoot = dir.trim();
  let moved = 0;
  let failed = 0;
  if (oldRoot && oldRoot !== newRoot) {
    for (const fp of await allFilePaths()) {
      try {
        const to = resolveInRoot(newRoot, fp);
        await mkdir(path.dirname(to), { recursive: true });
        await rename(resolveInRoot(oldRoot, fp), to);
        moved++;
      } catch {
        failed++;
      }
    }
  }
  await prisma.vaultConfig.upsert({
    where: { id: 1 },
    update: { storageRoot: newRoot },
    create: { id: 1, storageRoot: newRoot },
  });
  return { moved, failed };
}

// Navegador de pastas DA REDE (SMB). Devolve null se não for modo SMB (aí o
// route cai no navegador do filesystem local). `param` é relativo ao share.
export async function browseNetwork(param: string): Promise<{
  path: string;
  parent: string | null;
  separator: string;
  entries: { name: string; path: string }[];
} | null> {
  const cfg = smbConfig();
  if (!cfg) return null;
  const cur = normRel(param);
  const names = await smbListDirs(cfg, cur);
  const entries = names.map((n) => ({ name: n, path: cur ? `${cur}/${n}` : n }));
  const parent = cur === "" ? null : cur.includes("/") ? cur.slice(0, cur.lastIndexOf("/")) : "";
  return { path: cur, parent, separator: "\\", entries };
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
