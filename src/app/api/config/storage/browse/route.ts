import { readdir, access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { guardAdmin } from "@/lib/api-auth";

// Navegador de pastas DO SERVIDOR (só admin). Lê o filesystem real via Node,
// então se adapta ao SO onde o app roda: no container Linux mostra "/…", no
// Windows lista os drives "C:\", "D:\". Serve para escolher a pasta raiz sem
// digitar o caminho à mão — a trava de senha continua sendo no salvar.
export async function GET(req: Request) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;

  const sep = path.sep;
  const param = new URL(req.url).searchParams.get("path")?.trim() ?? "";

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
