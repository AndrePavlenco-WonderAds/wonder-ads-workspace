// Aprovar ou recusar um pedido de ausência — só superadmins.
//   POST { action: "approve" | "reject", note?: string }
//
// A decisão é idempotente na prática: quem chega segundo (o outro
// superadmin, na app ou no Slack) recebe 409 com o registo já decidido —
// nunca reescreve a primeira decisão. É este guard que faz a notificação
// "pendente" morrer no sino de toda a gente ao primeiro clique.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { decideAbsence } from "@/lib/absences-store";
import { announceAbsenceDecision } from "@/lib/absences-slack";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!employee.isAdmin) {
    return NextResponse.json(
      { error: "Só o C-Level pode decidir pedidos de ausência." },
      { status: 403 },
    );
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }
  const { action, note } = (body ?? {}) as { action?: unknown; note?: unknown };
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "action tem de ser approve ou reject." },
      { status: 400 },
    );
  }
  const cleanNote =
    typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null;

  let result;
  try {
    result = await decideAbsence(id, {
      status: action === "approve" ? "approved" : "rejected",
      decidedBy: employee.username,
      decidedByName: employee.name,
      note: cleanNote,
      via: "app",
    });
  } catch (err) {
    console.error("Ausências: decisão falhou:", err);
    return NextResponse.json(
      { error: "Não foi possível gravar a decisão — tenta outra vez." },
      { status: 500 },
    );
  }

  if (!result.ok) {
    if (result.reason === "not-found") {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    const r = result.record;
    return NextResponse.json(
      {
        error: `Este pedido já foi ${r.status === "approved" ? "aprovado" : "recusado"} por ${r.decidedByName ?? "outro superadmin"}.`,
        record: r,
      },
      { status: 409 },
    );
  }

  // O canal #ausencias conta a história completa — a decisão feita na app
  // entra lá como mensagem própria (a original já não é editável).
  await announceAbsenceDecision(result.record);

  return NextResponse.json({ ok: true, record: result.record });
}
