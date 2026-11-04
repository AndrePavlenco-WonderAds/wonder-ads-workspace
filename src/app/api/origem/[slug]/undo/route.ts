// POST /api/origem/<slug>/undo — anula um registo acabado de fazer.
//   { id, device } — só o mesmo aparelho e só nos 2 minutos a seguir.

import { NextResponse } from "next/server";
import { getLiveSnapshot, undoVote } from "@/lib/origem/store";
import { DEVICE_RE, origemGate, readJson } from "@/lib/origem/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const gate = await origemGate(slug, { write: true });
  if (gate instanceof NextResponse) return gate;
  const body = await readJson<Record<string, unknown>>(req);
  const id = typeof body?.id === "string" ? body.id : "";
  const device = typeof body?.device === "string" ? body.device : "";
  if (!id || !DEVICE_RE.test(device)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const ok = await undoVote(slug, id, device);
  if (!ok) return NextResponse.json({ error: "Já não é possível anular este registo." }, { status: 409 });
  const { stats, today } = await getLiveSnapshot(gate.cfg);
  return NextResponse.json({ ok: true, stats, today });
}
