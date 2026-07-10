import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { forbidden, requireEditor } from "@/lib/api-auth";

// Desbloqueia o cofre — só Societário, com o PIN.
export async function POST(req: Request) {
  if (!(await requireEditor())) return forbidden();
  const body = (await req.json().catch(() => null)) as { pin?: string } | null;
  const config = await prisma.vaultConfig.findUnique({ where: { id: 1 } });
  if (!config?.lockPinHash || !body?.pin || !bcrypt.compareSync(body.pin, config.lockPinHash)) {
    return NextResponse.json({ error: "PIN incorreto." }, { status: 401 });
  }
  await prisma.vaultConfig.update({ where: { id: 1 }, data: { locked: false } });
  return NextResponse.json({ ok: true });
}
