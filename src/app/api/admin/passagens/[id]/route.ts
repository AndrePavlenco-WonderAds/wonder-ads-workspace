// PATCH /api/admin/passagens/<id> — a direção gere uma passagem (v80.39).
// Só SuperAdmin. Uma operação por pedido:
//   { op: "incoming", slug, incoming: username | null }  quem fica com o projeto
//   { op: "add-project", slug }                          projeto novo na carteira
//   { op: "remove-project", slug }
//   { op: "exit", item, done }                           checklist de saída
//   { op: "end-date", endDate }
//   { op: "note", note }
//   { op: "status", status: "ativa" | "concluida" | "cancelada" }
//
// Passar o projeto no SEO DPT NÃO é aqui: o cockpit chama a migração que já
// existe (PUT /api/admin/seo-consultant/<slug>), que também arruma a ficha
// admin e o registo de onboarding. A passagem lê o dono atual e vê sozinha
// que o projeto passou.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getPassagem, getPassagemIndex, passagemConfigured, savePassagem, seoPortfolios } from "@/lib/passagem/store";
import { EXIT_CHECKLIST, isISODate, type ExitItemId, type PassagemStatus } from "@/lib/passagem/shared";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getCurrentEmployee();
  if (!me) return bad("Sessão inválida.", 401);
  if (!me.isAdmin) return bad("A passagem de consultor é só para SuperAdmin.", 403);
  if (!passagemConfigured) return bad("Armazenamento indisponível.", 503);

  const { id } = await ctx.params;
  const p = await getPassagem(id);
  if (!p) return bad("Passagem não encontrada.", 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const slug = typeof body.slug === "string" ? body.slug : "";

  switch (body.op) {
    case "incoming": {
      const project = p.projects.find((x) => x.slug === slug);
      if (!project) return bad("Projeto não encontrado nesta passagem.");
      if (body.incoming === null || body.incoming === "") {
        project.incoming = null;
        break;
      }
      const portfolios = await seoPortfolios();
      const person = portfolios.find((x) => x.username === body.incoming && x.username !== p.outgoing.username);
      if (!person) return bad("Escolhe um consultor SEO.");
      const leaving = (await getPassagemIndex()).some((e) => e.status === "ativa" && e.outgoing === person.username);
      if (leaving) return bad(`${person.name} também está de saída: não pode receber projetos.`);
      project.incoming = { username: person.username, name: person.name };
      break;
    }
    case "add-project": {
      if (p.projects.some((x) => x.slug === slug)) break;
      const portfolios = await seoPortfolios();
      const client = portfolios.find((x) => x.username === p.outgoing.username)?.clients.find((c) => c.slug === slug);
      if (!client) return bad("Esse projeto não está na carteira de quem sai.");
      p.projects.push({ slug: client.slug, title: client.title, incoming: null });
      p.projects.sort((a, b) => a.title.localeCompare(b.title, "pt"));
      break;
    }
    case "remove-project": {
      if (p.projects.length <= 1) return bad("A passagem tem de ter pelo menos um projeto.");
      p.projects = p.projects.filter((x) => x.slug !== slug);
      break;
    }
    case "exit": {
      const item = EXIT_CHECKLIST.find((i) => i.id === body.item);
      if (!item) return bad("Item desconhecido.");
      if (body.done === true) p.exit[item.id as ExitItemId] = { at: Date.now(), by: me.name };
      else delete p.exit[item.id as ExitItemId];
      break;
    }
    case "end-date": {
      if (!isISODate(body.endDate) || body.endDate < p.startDate) return bad("Data de fim inválida.");
      p.endDate = body.endDate;
      break;
    }
    case "note": {
      p.note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
      break;
    }
    case "status": {
      const status = body.status as PassagemStatus;
      if (!["ativa", "concluida", "cancelada"].includes(status)) return bad("Estado inválido.");
      p.status = status;
      p.closedAt = status === "ativa" ? null : Date.now();
      p.closedBy = status === "ativa" ? null : { username: me.username, name: me.name };
      break;
    }
    default:
      return bad("Operação desconhecida.");
  }

  const saved = await savePassagem(p);
  return NextResponse.json({ passagem: saved }, { headers: NO_STORE });
}
