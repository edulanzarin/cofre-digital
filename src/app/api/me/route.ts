import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  return NextResponse.json({
    name: user.name,
    email: user.email,
    sector: user.sector,
    admin: user.admin,
    rules: user.rules,
  });
}
