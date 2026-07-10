// Guardas de sessão para as route handlers.
import { NextResponse } from "next/server";
import { getSession, isEditor, type Session } from "./auth";
import { prisma } from "./prisma";

export const unauthorized = () =>
  NextResponse.json({ error: "Não autenticado." }, { status: 401 });

export const forbidden = () =>
  NextResponse.json(
    { error: "Apenas o setor Societário pode fazer isso." },
    { status: 403 },
  );

export const vaultLocked = () =>
  NextResponse.json(
    { error: "O cofre está bloqueado pelo Societário." },
    { status: 423 },
  );

export async function requireUser(): Promise<Session | null> {
  return getSession();
}

export async function requireEditor(): Promise<Session | null> {
  const session = await getSession();
  if (!session || !isEditor(session)) return null;
  return session;
}

// Para rotas de dados: com o cofre bloqueado, só o Societário passa.
// Retorna "locked" para o handler responder 423.
export async function requireUnlockedUser(): Promise<Session | "locked" | null> {
  const session = await getSession();
  if (!session) return null;
  if (isEditor(session)) return session;
  const config = await prisma.vaultConfig.findUnique({
    where: { id: 1 },
    select: { locked: true },
  });
  if (config?.locked) return "locked";
  return session;
}
