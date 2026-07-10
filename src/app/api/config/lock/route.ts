import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireEditor } from "@/lib/api-auth";

// Bloqueia o cofre para TODOS os setores (só Societário).
export async function POST() {
  if (!(await requireEditor())) return forbidden();
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
