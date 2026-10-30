// /api/admin/producer — a eleição do Producer of the Month (v78.58).
//
//   POST   { month, podium: [username, username?, username?], note } → elege
//   DELETE { month }                                                  → anula
//
// Só SuperAdmin, na própria sessão. A app NUNCA escolhe: o pódio é o que a
// direção manda. A eleição guarda o levantamento desse momento, avisa o
// #team-wins quando o 1.º lugar é novo e volta a contar as medalhas.

import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { lisbonMonthKey } from "@/lib/dates";
import { seoConsultants } from "@/lib/documentacao/people";
import { syncMedalsAndNotify } from "@/lib/medals/notify";
import { announceProducer } from "@/lib/producer/notify";
import { buildProducerSurvey } from "@/lib/producer/server";
import { MAX_PRODUCER_NOTE, electableMonths, type ProducerPlace } from "@/lib/producer/shared";
import { PRODUCER_CACHE_TAG, deleteElection, getElection, saveElection } from "@/lib/producer/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: NO_STORE });

async function guard() {
  const me = await getCurrentEmployee();
  if (!me) return { res: bad("Sessão inválida.", 401) } as const;
  if (!me.isAdmin) return { res: bad("Só a direção elege o Producer of the Month.", 403) } as const;
  // Falha fechada: se a leitura da lente rebentar, trata-se como lente ativa.
  if (await getImpersonation().catch(() => ({ failed: true }))) {
    return { res: bad("Estás a ver a app como outra pessoa — esta vista é só de leitura.", 403) } as const;
  }
  return { me } as const;
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function checkMonth(v: unknown): string | null {
  const month = typeof v === "string" ? v : "";
  return electableMonths(lisbonMonthKey(Date.now())).includes(month) ? month : null;
}

export async function POST(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;
  const body = await readBody(req);
  if (!body) return bad("Pedido inválido.");
  const month = checkMonth(body.month);
  if (!month) return bad("Só se elege um mês que já fechou.");

  const people = new Map(seoConsultants().map((p) => [p.username, p]));
  const picked = (Array.isArray(body.podium) ? body.podium : []).map((u) => (typeof u === "string" ? u.trim() : ""));
  // Os lugares vazios (2.º ou 3.º por eleger) ficam de fora; o 1.º não.
  if (!picked[0]) return bad("Escolhe o Producer of the Month (1.º lugar).");
  const usernames = picked.slice(0, 3).filter(Boolean);
  if (new Set(usernames).size !== usernames.length) return bad("A mesma pessoa não pode ter dois lugares no pódio.");
  const podium: ProducerPlace[] = [];
  for (const u of usernames) {
    const p = people.get(u);
    if (!p) return bad("Só consultores do SEO DPT entram no pódio.");
    podium.push({ username: p.username, name: p.name });
  }
  const note = typeof body.note === "string" ? body.note.replace(/\r\n?/g, "\n").trim() : "";
  if (note.length > MAX_PRODUCER_NOTE) return bad(`A nota tem de ter até ${MAX_PRODUCER_NOTE} caracteres.`);

  const [before, snapshot] = await Promise.all([getElection(month), buildProducerSurvey(month)]);
  const election = {
    month,
    podium,
    note,
    electedBy: g.me.username,
    electedByName: g.me.name,
    electedAt: Date.now(),
    snapshot,
  };
  await saveElection(election);
  revalidateTag(PRODUCER_CACHE_TAG);

  // O #team-wins só ouve quando o 1.º lugar é novo — corrigir o 2.º, o 3.º
  // ou a nota não volta a anunciar.
  const fresh = before?.podium[0]?.username !== podium[0].username;
  after(async () => {
    if (fresh) await announceProducer(election);
    await syncMedalsAndNotify("producer-election");
  });
  return NextResponse.json({ ok: true, announced: fresh }, { headers: NO_STORE });
}

export async function DELETE(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;
  const body = await readBody(req);
  const month = checkMonth(body?.month);
  if (!month) return bad("Mês inválido.");
  const removed = await deleteElection(month);
  revalidateTag(PRODUCER_CACHE_TAG);
  if (removed) after(() => syncMedalsAndNotify("producer-cancel"));
  return NextResponse.json({ ok: true, removed }, { headers: NO_STORE });
}
