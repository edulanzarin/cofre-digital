import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-auth";
import { toCompanyEventDTO } from "@/lib/company-event-api";

type Params = { params: Promise<{ id: string; eventId: string }> };

// Fixar/soltar uma anotação. Fixado é o que fica à vista no topo do cofre,
// em qualquer aba — só anotação se fixa; cadastro e alteração são registro,
// não recado. Quem anota também fixa: exigir edição do cadastro aqui
// deixaria o setor que só consulta sem o quadro de avisos.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await guard("empresas", "view");
  if (auth instanceof NextResponse) return auth;
  const { id, eventId } = await params;
  const body = (await req.json().catch(() => null)) as { pinned?: boolean } | null;
  if (typeof body?.pinned !== "boolean") {
    return NextResponse.json({ error: "Informe se a anotação fica fixada." }, { status: 400 });
  }
  const event = await prisma.companyEvent.findFirst({
    where: { id: eventId, companyId: id },
    select: { id: true, kind: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Anotação não encontrada." }, { status: 404 });
  }
  if (event.kind !== "note") {
    return NextResponse.json(
      { error: "Só anotações podem ser fixadas." },
      { status: 400 },
    );
  }
  const row = await prisma.companyEvent.update({
    where: { id: eventId },
    data: { pinned: body.pinned },
  });
  return NextResponse.json(toCompanyEventDTO(row));
}
