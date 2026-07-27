import { NextResponse } from "next/server";
import { guardAdmin } from "@/lib/api-auth";
import { changeStorage, validateStoragePath } from "@/lib/storage";

// Definir/alterar a pasta raiz dos arquivos. Duas travas: admin (a seção mora
// na área de admin) e a senha, que vive só na env `STORAGE_ROOT_PASSWORD` — em
// produção o Eduardo a define lá, e nem o banco nem o navegador a conhecem.
export async function PUT(req: Request) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;

  const envPass = process.env.STORAGE_ROOT_PASSWORD?.trim();
  if (!envPass) {
    return NextResponse.json(
      {
        error:
          "Defina STORAGE_ROOT_PASSWORD no .env do servidor para poder alterar a pasta.",
      },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    path?: string;
    password?: string;
  } | null;
  if (!body || typeof body.path !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  if (body.password !== envPass) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 403 });
  }

  const dir = body.path.trim();
  if (!dir) {
    return NextResponse.json({ error: "Informe o caminho da pasta." }, { status: 400 });
  }
  const check = await validateStoragePath(dir);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  // Troca a pasta e move os arquivos existentes para lá.
  const { moved, failed } = await changeStorage(dir);
  return NextResponse.json({ moved, failed });
}
