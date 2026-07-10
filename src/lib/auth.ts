import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Sector } from "@/generated/prisma/enums";

export const COOKIE_NAME = "vault_session";
const SESSION_DAYS = 7;

export type Session = {
  sub: string;
  name: string;
  email: string;
  sector: Sector;
};

// Societário é quem administra o cofre; os demais setores só leem.
export function isEditor(session: Pick<Session, "sector">): boolean {
  return session.sector === "SOCIETARIO";
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não definido");
  return new TextEncoder().encode(secret);
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE !== "false",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      sub: payload.sub as string,
      name: payload.name as string,
      email: payload.email as string,
      sector: payload.sector as Sector,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
