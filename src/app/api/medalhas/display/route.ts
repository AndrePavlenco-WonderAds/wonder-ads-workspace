// POST /api/medalhas/display — grava as medalhas que a pessoa quer no
// header (até 3, só das que tem). Sessão obrigatória (middleware); com
// «Ver como» ativo recusa — a lente é só de leitura.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { MAX_DISPLAYED, isMedalId } from "@/lib/medals/catalog";
import { getMedalsForUser } from "@/lib/medals/server";
import { setDisplayChoice } from "@/lib/medals/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  if (await getImpersonation().catch(() => null)) {
    return NextResponse.json({ error: "A ver como outra pessoa — a escolha é só de leitura." }, { status: 403 });
  }
  let body: { ids?: unknown };
  try {
    body = (await req.json()) as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!Array.isArray(body.ids) || body.ids.length > MAX_DISPLAYED || !body.ids.every(isMedalId)) {
    return NextResponse.json({ error: `Escolhe até ${MAX_DISPLAYED} medalhas válidas.` }, { status: 400 });
  }
  const ids = Array.from(new Set(body.ids as string[]));
  const mine = await getMedalsForUser(employee.username);
  const have = new Set(mine.earned.map((e) => e.medal.id));
  const notMine = ids.filter((id) => !have.has(id));
  if (notMine.length) {
    return NextResponse.json({ error: "Só podes mostrar medalhas que já ganhaste." }, { status: 400 });
  }
  try {
    await setDisplayChoice(employee.username, ids);
    revalidatePath("/medalhas");
    return NextResponse.json({ ok: true, ids });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
