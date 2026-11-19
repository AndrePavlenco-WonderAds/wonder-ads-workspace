// POST /api/origem/<slug>/manage — a equipa apaga registos (v80.4).
//   { op: "delete", id, confirm: "Confirmar" }               — um registo
//   { op: "reset", period, site|null, confirm: "Confirmar" } — hoje / o mês / desde o início
// Só a equipa que edita o SEO (nunca o PIN da receção). O que sai fica no
// histórico, e um SuperAdmin repõe em /history.
// → { removed, history, today }

import { NextResponse } from "next/server";
import { isPeriod } from "@/lib/origem/manage";
import { deleteVote, getFullSnapshot, resetVotes } from "@/lib/origem/store";
import { isConfirmWord, origemGate, readJson } from "@/lib/origem/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const gate = await origemGate(slug, { write: true, manage: true });
  if (gate instanceof NextResponse) return gate;
  const { cfg, viewer } = gate;
  if (viewer.kind !== "team") return NextResponse.json({ error: "Só a equipa WonderAds pode apagar registos." }, { status: 403 });

  const body = await readJson<Record<string, unknown>>(req);
  if (!isConfirmWord(body?.confirm)) return NextResponse.json({ error: "Escreva «Confirmar» para apagar." }, { status: 400 });
  const actor = { username: viewer.username, name: viewer.name };

  let removed: number;
  if (body?.op === "delete") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^o-[a-z0-9]+-[a-z0-9]+$/.test(id)) return NextResponse.json({ error: "Registo desconhecido." }, { status: 400 });
    removed = await deleteVote(slug, id, actor);
    if (!removed) return NextResponse.json({ error: "Este registo já não existe." }, { status: 404 });
  } else if (body?.op === "reset") {
    const period = body.period;
    const site = typeof body.site === "string" && body.site ? body.site : null;
    if (!isPeriod(period)) return NextResponse.json({ error: "Escolha o período." }, { status: 400 });
    if (site && !cfg.sites.some((s) => s.id === site)) return NextResponse.json({ error: "Local desconhecido." }, { status: 400 });
    removed = await resetVotes(cfg, period, site, actor);
  } else {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const { history, today } = await getFullSnapshot(cfg);
  return NextResponse.json({ removed, history, today }, { headers: { "Cache-Control": "no-store" } });
}
