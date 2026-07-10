import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  if (!body?.email || !body.password) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: body.email.trim().toLowerCase() },
  });
  if (!user || !bcrypt.compareSync(body.password, user.passwordHash)) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  await createSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    sector: user.sector,
  });
  return NextResponse.json({ ok: true });
}
