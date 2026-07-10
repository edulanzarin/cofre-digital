import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireEditor, requireUser, unauthorized } from "@/lib/api-auth";

const ALERT_OPTIONS = [15, 30, 45, 60, 90];
const LOCK_MINUTES_OPTIONS = [5, 15, 30, 60];

async function readConfig() {
  return prisma.vaultConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

function toDTO(config: Awaited<ReturnType<typeof readConfig>>) {
  return {
    alertDays: config.alertDays,
    autoLock: config.autoLock,
    lockMinutes: config.lockMinutes,
    locked: config.locked,
    hasPin: config.lockPinHash !== null,
  };
}

export async function GET() {
  if (!(await requireUser())) return unauthorized();
  return NextResponse.json(toDTO(await readConfig()));
}

// Política do cofre — só o Societário, vale para todos os setores.
export async function PUT(req: Request) {
  if (!(await requireEditor())) return forbidden();
  const body = (await req.json().catch(() => null)) as {
    alertDays?: number;
    autoLock?: boolean;
    lockMinutes?: number;
  } | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

  const data: { alertDays?: number; autoLock?: boolean; lockMinutes?: number } = {};
  if (body.alertDays !== undefined) {
    if (!ALERT_OPTIONS.includes(body.alertDays)) {
      return NextResponse.json({ error: "Janela inválida." }, { status: 400 });
    }
    data.alertDays = body.alertDays;
  }
  if (body.autoLock !== undefined) {
    if (typeof body.autoLock !== "boolean") {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }
    data.autoLock = body.autoLock;
  }
  if (body.lockMinutes !== undefined) {
    if (!LOCK_MINUTES_OPTIONS.includes(body.lockMinutes)) {
      return NextResponse.json({ error: "Tempo inválido." }, { status: 400 });
    }
    data.lockMinutes = body.lockMinutes;
  }

  const config = await prisma.vaultConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  return NextResponse.json(toDTO(config));
}
