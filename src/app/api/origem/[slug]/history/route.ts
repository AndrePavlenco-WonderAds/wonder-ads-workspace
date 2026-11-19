// /api/origem/<slug>/history — o que a equipa apagou (v80.4). Só SuperAdmin.
//   GET               → { actions }
//   POST { id }       → repõe essa ação → { actions, history, today }

import { NextResponse } from "next/server";
import { getFullSnapshot, listActions, revertAction } from "@/lib/origem/store";
import { origemGate, readJson } from "@/lib/origem/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const gate = await origemGate(slug, { superAdmin: true });
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ actions: await listActions(slug) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const gate = await origemGate(slug, { write: true, superAdmin: true });
  if (gate instanceof NextResponse) return gate;
  const { cfg, viewer } = gate;
  if (viewer.kind !== "team") return NextResponse.json({ error: "Só um SuperAdmin pode repor." }, { status: 403 });

  const body = await readJson<{ id?: unknown }>(req);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^a-[a-z0-9]+-[a-z0-9]+$/.test(id)) return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  const result = await revertAction(slug, id, { username: viewer.username, name: viewer.name });
  if (result === "missing") return NextResponse.json({ error: "Esta ação já não está no histórico." }, { status: 404 });
  if (result === "already") return NextResponse.json({ error: "Esta ação já foi reposta." }, { status: 409 });

  const [actions, snap] = await Promise.all([listActions(slug), getFullSnapshot(cfg)]);
  return NextResponse.json({ actions, ...snap }, { headers: { "Cache-Control": "no-store" } });
}
