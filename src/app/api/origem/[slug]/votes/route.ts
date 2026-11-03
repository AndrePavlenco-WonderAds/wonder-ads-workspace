// POST /api/origem/<slug>/votes — regista uma pessoa nova.
//   { site, source, channel?, device } → { vote, today }
// `today` = registos de hoje nessa clínica, para o contador do ecrã.

import { NextResponse } from "next/server";
import { addVote, getMonthStats } from "@/lib/origem/store";
import { DEVICE_RE, clientIp, origemGate, overLimit, readJson } from "@/lib/origem/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const gate = await origemGate(slug, { write: true });
  if (gate instanceof NextResponse) return gate;
  const { cfg, viewer } = gate;

  const body = await readJson<Record<string, unknown>>(req);
  const site = typeof body?.site === "string" ? body.site : "";
  const source = typeof body?.source === "string" ? body.source : "";
  const channel = typeof body?.channel === "string" && body.channel ? body.channel : null;
  const device = typeof body?.device === "string" ? body.device : "";
  if (!cfg.sites.some((s) => s.id === site)) return NextResponse.json({ error: `Escolha ${cfg.place.the}.` }, { status: 400 });
  if (!cfg.sources.some((s) => s.id === source)) return NextResponse.json({ error: "Escolha a origem." }, { status: 400 });
  if (channel && !cfg.channels.some((c) => c.id === channel)) return NextResponse.json({ error: "Canal desconhecido." }, { status: 400 });
  if (!DEVICE_RE.test(device)) return NextResponse.json({ error: "Aparelho desconhecido. Recarregue a página." }, { status: 400 });

  // Uma receção regista umas dezenas por dia; 40 por minuto já não é gente.
  if (await overLimit(`origem:${slug}:rl:${clientIp(req)}`, 40, 60)) {
    return NextResponse.json({ error: "Demasiados registos em pouco tempo. Aguarde um momento." }, { status: 429 });
  }

  const vote = await addVote(slug, { site, source, channel, device, by: viewer.username ?? "client" });
  const stats = await getMonthStats(cfg, vote.month);
  const today = stats.sites[site]?.days[vote.day - 1] ?? 1;
  return NextResponse.json({ vote: { id: vote.id, at: vote.at }, today, stats });
}
