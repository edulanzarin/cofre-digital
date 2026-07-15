import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api-auth";

// Bloqueia o cofre para TODOS (só admin).
export async function POST() {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const config = await prisma.vaultConfig.findUnique({ where: { id: 1 } });
  if (!config?.lockPinHash) {
    return NextResponse.json(
      { error: "Defina um PIN antes de bloquear o cofre." },
      { status: 400 },
    );
  }
  await prisma.vaultConfig.update({ where: { id: 1 }, data: { locked: true } });
  return NextResponse.json({ ok: true });
}
