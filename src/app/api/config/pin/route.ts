import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { forbidden, requireEditor } from "@/lib/api-auth";

// Define/altera o PIN de bloqueio do cofre (só Societário).
export async function PUT(req: Request) {
  if (!(await requireEditor())) return forbidden();
  const body = (await req.json().catch(() => null)) as { pin?: string } | null;
  if (!body?.pin || body.pin.length < 4) {
    return NextResponse.json({ error: "PIN mínimo de 4 dígitos." }, { status: 400 });
  }
  await prisma.vaultConfig.upsert({
    where: { id: 1 },
    update: { lockPinHash: bcrypt.hashSync(body.pin, 10) },
    create: { id: 1, lockPinHash: bcrypt.hashSync(body.pin, 10) },
  });
  return NextResponse.json({ ok: true });
}

// Remove o PIN (e desbloqueia, para não trancar o cofre sem chave).
export async function DELETE() {
  if (!(await requireEditor())) return forbidden();
  await prisma.vaultConfig.upsert({
    where: { id: 1 },
    update: { lockPinHash: null, locked: false },
    create: { id: 1 },
  });
  return NextResponse.json({ ok: true });
}
