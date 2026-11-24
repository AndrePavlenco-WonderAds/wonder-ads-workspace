// /api/passagem/<id>/<slug> — a ficha de um projeto na passagem (v80.39).
//
//   PUT  { ficha }   quem sai (ou a direção) grava a ficha — autosave
//   POST { action }  "ready" | "unready"    quem sai marca a ficha pronta
//                    "ask" { q }            quem entra (ou a direção) pergunta
//                    "answer" { qid, a }    quem sai (ou a direção) responde
//                    "sign" | "unsign"      quem entra assume o projeto
//
// O papel vem da sessão (com «Ver como» o middleware já recusou a escrita).
// Uma passagem concluída ou cancelada fica só para ler.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  answerQuestion,
  askQuestion,
  getFicha,
  getPassagem,
  listQuestions,
  passagemConfigured,
  roleIn,
  saveFicha,
  setSign,
} from "@/lib/passagem/store";
import { ANSWER_MAX, QUESTION_MAX, sanitizeFichaContent } from "@/lib/passagem/shared";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

type Ctx = { params: Promise<{ id: string; slug: string }> };

async function load(ctx: Ctx) {
  const me = await getCurrentEmployee();
  if (!me) return { error: bad("Sessão inválida.", 401) } as const;
  if (me.viewerOf || me.docsOnly) return { error: bad("Este perfil não pode mexer em passagens.", 403) } as const;
  if (!passagemConfigured) return { error: bad("Armazenamento indisponível.", 503) } as const;
  const { id, slug } = await ctx.params;
  const p = await getPassagem(id);
  if (!p) return { error: bad("Passagem não encontrada.", 404) } as const;
  const access = roleIn(p, { username: me.username, isAdmin: me.isAdmin });
  if (!access || !access.slugs.includes(slug)) return { error: bad("Não tens acesso a este projeto.", 403) } as const;
  if (p.status !== "ativa") return { error: bad("Esta passagem já está fechada.", 409) } as const;
  const project = p.projects.find((x) => x.slug === slug)!;
  return { me, p, slug, project, role: access.role } as const;
}

export async function PUT(req: Request, ctx: Ctx) {
  const c = await load(ctx);
  if ("error" in c) return c.error;
  if (c.role === "incoming") return bad("Só quem sai escreve a ficha.", 403);
  const body = (await req.json().catch(() => ({}))) as { ficha?: unknown };
  const current = await getFicha(c.p.id, c.slug);
  const saved = await saveFicha(c.p.id, c.slug, { ...current, ...sanitizeFichaContent(body.ficha) });
  return NextResponse.json({ ficha: saved }, { headers: NO_STORE });
}

export async function POST(req: Request, ctx: Ctx) {
  const c = await load(ctx);
  if ("error" in c) return c.error;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const who = { username: c.me.username, name: c.me.name };

  switch (body.action) {
    case "ready":
    case "unready": {
      if (c.role === "incoming") return bad("Só quem sai marca a ficha como pronta.", 403);
      const current = await getFicha(c.p.id, c.slug);
      const saved = await saveFicha(c.p.id, c.slug, {
        ...current,
        readyAt: body.action === "ready" ? (current.readyAt ?? Date.now()) : null,
      });
      return NextResponse.json({ ficha: saved }, { headers: NO_STORE });
    }
    case "ask": {
      if (c.role === "outgoing") return bad("As perguntas são de quem entra.", 403);
      const q = typeof body.q === "string" ? body.q.trim() : "";
      if (q.length < 3) return bad("Escreve a pergunta.");
      if (q.length > QUESTION_MAX) return bad(`Máximo de ${QUESTION_MAX} caracteres.`);
      await askQuestion(c.p.id, c.slug, q, who);
      break;
    }
    case "answer": {
      if (c.role === "incoming") return bad("Quem responde é quem sai.", 403);
      const a = typeof body.a === "string" ? body.a.trim() : "";
      if (a.length < 1) return bad("Escreve a resposta.");
      if (a.length > ANSWER_MAX) return bad(`Máximo de ${ANSWER_MAX} caracteres.`);
      const qid = typeof body.qid === "string" ? body.qid : "";
      const all = await listQuestions(c.p.id);
      if (!all.some((q) => q.id === qid && q.slug === c.slug)) return bad("Pergunta não encontrada.", 404);
      await answerQuestion(c.p.id, qid, a, who);
      break;
    }
    case "sign":
    case "unsign": {
      if (c.role !== "incoming" || c.project.incoming?.username !== c.me.username) {
        return bad("Só quem fica com o projeto o pode assumir.", 403);
      }
      if (body.action === "sign") {
        const ficha = await getFicha(c.p.id, c.slug);
        if (!ficha.readyAt) return bad("A ficha ainda não está pronta.", 409);
        await setSign(c.p.id, c.slug, { at: Date.now(), by: who });
      } else {
        await setSign(c.p.id, c.slug, null);
      }
      break;
    }
    default:
      return bad("Ação desconhecida.");
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
