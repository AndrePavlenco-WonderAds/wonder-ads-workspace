// O «Entendido» do consultor — confirma que viu a resposta ao seu pedido.
//   POST (sem body)
//
// Só o dono do pedido, e só depois de decidido. É isto que faz a
// notificação da resposta desaparecer do sino dele.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { acknowledgeAbsence } from "@/lib/absences-store";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const ok = await acknowledgeAbsence(id, employee.username);
    if (!ok) {
      return NextResponse.json(
        { error: "Pedido não encontrado, de outra pessoa, ou ainda pendente." },
        { status: 404 },
      );
    }
  } catch (err) {
    console.error("Ausências: ack falhou:", err);
    return NextResponse.json(
      { error: "Não foi possível gravar — tenta outra vez." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
