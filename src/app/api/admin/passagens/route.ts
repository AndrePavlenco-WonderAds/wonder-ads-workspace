// POST /api/admin/passagens — a direção abre a passagem de um consultor
// (v80.39). Só SuperAdmin; o middleware já recusa escritas com «Ver como».
//
// Body: { outgoing, reason, startDate, endDate?, note?, projects: [{ slug, incoming }] }
// Os projetos têm de ser da carteira ATIVA de quem sai, agora; quem entra
// tem de ser outro consultor SEO.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { activePassagemOf, createPassagem, getPassagemIndex, passagemConfigured, seoPortfolios } from "@/lib/passagem/store";
import {
  PASSAGEM_DAYS,
  PASSAGEM_REASONS,
  addDaysISO,
  isISODate,
  type PassagemProjectRef,
  type PassagemReason,
} from "@/lib/passagem/shared";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return bad("Sessão inválida.", 401);
  if (!me.isAdmin) return bad("A passagem de consultor é só para SuperAdmin.", 403);
  if (!passagemConfigured) return bad("Armazenamento indisponível.", 503);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const portfolios = await seoPortfolios();
  const outgoing = portfolios.find((p) => p.username === body.outgoing);
  if (!outgoing) return bad("Escolhe o consultor que sai.");
  if (await activePassagemOf(outgoing.username)) {
    return bad(`${outgoing.name} já tem uma passagem a decorrer.`, 409);
  }

  const reason = PASSAGEM_REASONS.some((r) => r.id === body.reason) ? (body.reason as PassagemReason) : null;
  if (!reason) return bad("Escolhe o motivo.");
  if (!isISODate(body.startDate)) return bad("Data de início inválida.");
  const startDate = body.startDate;
  const endDate = isISODate(body.endDate) && body.endDate > startDate ? body.endDate : addDaysISO(startDate, PASSAGEM_DAYS - 1);

  const owned = new Map(outgoing.clients.map((c) => [c.slug, c]));
  // Quem está a sair noutra passagem não recebe projetos.
  const leaving = new Set((await getPassagemIndex()).filter((e) => e.status === "ativa").map((e) => e.outgoing));
  const people = new Map(
    portfolios.filter((p) => p.username !== outgoing.username && !leaving.has(p.username)).map((p) => [p.username, p]),
  );
  const rawProjects = Array.isArray(body.projects) ? body.projects : [];
  const projects: PassagemProjectRef[] = [];
  for (const raw of rawProjects) {
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const client = typeof r.slug === "string" ? owned.get(r.slug) : undefined;
    if (!client || projects.some((p) => p.slug === client.slug)) continue;
    const inc = typeof r.incoming === "string" ? people.get(r.incoming) : undefined;
    projects.push({
      slug: client.slug,
      title: client.title,
      incoming: inc ? { username: inc.username, name: inc.name } : null,
    });
  }
  if (projects.length === 0) return bad("Escolhe pelo menos um projeto.");

  const passagem = await createPassagem({
    outgoing: { username: outgoing.username, name: outgoing.name },
    reason,
    startDate,
    endDate,
    note: typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "",
    projects,
    createdBy: { username: me.username, name: me.name },
  });
  return NextResponse.json({ id: passagem.id }, { headers: NO_STORE });
}
