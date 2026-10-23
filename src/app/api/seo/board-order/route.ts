// PUT    /api/seo/board-order   { slugs: string[] } — grava a ordem da lane
// DELETE /api/seo/board-order                     — volta à ordem por tier
//
// A ordem pessoal da carteira na board do SEO DPT (v78.4). Só o próprio
// consultor de SEO, na sua sessão: um SuperAdmin não tem lane, e em «Ver
// como» não se grava nada em nome de outra pessoa. Os slugs são filtrados
// pela carteira ATUAL de quem grava — ninguém mexe na lane de um colega.

import { NextResponse } from "next/server";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getSeoClients } from "@/lib/notion";
import { getConsultantResolver } from "@/lib/consultant-assignments";
import { clearBoardOrder, setBoardOrder } from "@/lib/seo-board-order-store";

export const runtime = "nodejs";

async function authorise(): Promise<
  { username: string; name: string } | NextResponse
> {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (employee.isAdmin || !editableDepts(employee).includes("seo")) {
    return NextResponse.json(
      { error: "Só os consultores de SEO podem ordenar a sua carteira." },
      { status: 403 },
    );
  }
  if (await getImpersonation().catch(() => null)) {
    return NextResponse.json(
      { error: "Em «Ver como» a ordem não se grava — só o próprio consultor." },
      { status: 403 },
    );
  }
  return { username: employee.username, name: employee.name };
}

export async function PUT(req: Request) {
  const who = await authorise();
  if (who instanceof NextResponse) return who;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const raw = (body as { slugs?: unknown } | null)?.slugs;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "Falta a lista de clientes." }, { status: 400 });
  }

  const consultants = await getConsultantResolver();
  const mine = new Set(
    (await getSeoClients())
      .filter((c) => consultants.resolve(c.slug, c.consultant) === who.name)
      .map((c) => c.slug),
  );
  const seen = new Set<string>();
  const slugs = raw.filter(
    (s): s is string =>
      typeof s === "string" && mine.has(s) && !seen.has(s) && Boolean(seen.add(s)),
  );

  try {
    await setBoardOrder(who.username, slugs);
  } catch (err) {
    console.error("board-order save failed:", err);
    return NextResponse.json({ error: "Não foi possível gravar a ordem." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slugs });
}

export async function DELETE() {
  const who = await authorise();
  if (who instanceof NextResponse) return who;
  try {
    await clearBoardOrder(who.username);
  } catch (err) {
    console.error("board-order reset failed:", err);
    return NextResponse.json({ error: "Não foi possível repor a ordem." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
