import { readdir, access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { guardAdmin } from "@/lib/api-auth";
import { browseNetwork } from "@/lib/storage";

// Navegador de pastas para escolher a pasta raiz (só admin). Em produção (SMB),
// navega as pastas DA REDE via smbclient; sem SMB, lê o filesystem do servidor
// (no container Linux mostra "/…", no Windows os drives). A trava de senha
// continua sendo no salvar.
export async function GET(req: Request) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;

  const sep = path.sep;
  const param = new URL(req.url).searchParams.get("path")?.trim() ?? "";

  // Modo rede: navega o compartilhamento. null = não é SMB, cai pro filesystem.
  try {
    const net = await browseNetwork(param);
    if (net) return NextResponse.json(net);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível abrir esta pasta da rede." },
      { status: 400 },
    );
  }

  // Sem caminho: no Windows, lista os drives; no resto, começa na raiz "/".
  if (!param) {
    if (process.platform === "win32") {
      const drives: { name: string; path: string }[] = [];
      for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        const d = `${letter}:\\`;
        try {
          await access(d);
          drives.push({ name: `${letter}:`, path: d });
        } catch {
          // drive inexistente
        }
      }
      return NextResponse.json({ path: "", parent: null, separator: sep, entries: drives });
    }
    return listDir("/", sep);
  }

  return listDir(path.resolve(param), sep);
}

async function listDir(dir: string, sep: string) {
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    const entries = dirents
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: path.join(dir, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Pai: no topo (drive no Windows, "/" no resto) volta pra listagem de raízes.
    const parentPath = path.dirname(dir);
    const parent =
      parentPath === dir ? (process.platform === "win32" ? "" : null) : parentPath;

    return NextResponse.json({ path: dir, parent, separator: sep, entries });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível abrir esta pasta." },
      { status: 400 },
    );
  }
}
