import { NextResponse } from "next/server";
import { isEditor } from "@/lib/auth";
import { requireUser, unauthorized } from "@/lib/api-auth";

export async function GET() {
  const session = await requireUser();
  if (!session) return unauthorized();
  return NextResponse.json({
    name: session.name,
    email: session.email,
    sector: session.sector,
    editor: isEditor(session),
  });
}
