// Guardas de sessão e permissão para as route handlers.
//
// Uso típico:
//   const auth = await guard("certificados", "edit");
//   if (auth instanceof NextResponse) return auth;
//   // auth é o usuário, com admin/rules do perfil
import { NextResponse } from "next/server";
import { getSession, type Session } from "./auth";
import { prisma } from "./prisma";
import {
  allows,
  parseRules,
  type Level,
  type ModuleKey,
  type PermissionRules,
} from "./permissions";

export type AuthUser = Session & { admin: boolean; rules: PermissionRules };

export const unauthorized = () =>
  NextResponse.json({ error: "Não autenticado." }, { status: 401 });

export const forbidden = () =>
  NextResponse.json(
    { error: "Seu perfil de acesso não permite esta ação." },
    { status: 403 },
  );

export const vaultLocked = () =>
  NextResponse.json(
    { error: "O cofre está bloqueado por um administrador." },
    { status: 423 },
  );

// Sessão + perfil de acesso. As permissões vêm do banco a cada request:
// trocar o perfil de alguém vale imediatamente, sem novo login.
export async function requireUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { profile: { select: { admin: true, rules: true } } },
  });
  if (!user) return null; // usuário removido com sessão ainda válida
  return {
    ...session,
    admin: user.profile?.admin ?? false,
    rules: parseRules(user.profile?.rules),
  };
}

// Nível mínimo num módulo. Com o cofre bloqueado, só admins passam.
export async function guard(
  module: ModuleKey,
  min: Level,
): Promise<AuthUser | NextResponse> {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!user.admin) {
    const config = await prisma.vaultConfig.findUnique({
      where: { id: 1 },
      select: { locked: true },
    });
    if (config?.locked) return vaultLocked();
  }
  if (!allows(user, module, min)) return forbidden();
  return user;
}

// Só admins: equipe, perfis e políticas do cofre.
export async function guardAdmin(): Promise<AuthUser | NextResponse> {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!user.admin) return forbidden();
  return user;
}
