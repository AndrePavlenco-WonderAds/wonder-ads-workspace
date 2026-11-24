// «Acionar o Botão» (v80.34).
//   POST  { client: slug | "interno", problem, solutions[], meeting }  → cria
//   PATCH { id, reply }                                                → a direção fecha
//
// A identidade vem SEMPRE da sessão. O cliente tem de ser da carteira de quem
// envia (re-resolvida aqui, nunca confiada ao browser). O «Ver como» não
// escreve: o middleware recusa qualquer escrita com a lente ativa.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  BOTAO_INTERNAL,
  BOTAO_MAX_SOLUTIONS,
  oneLine,
  validateBotaoDraft,
  BOTAO_SOLUTION_MAX,
} from "@/lib/botao/shared";
import { botaoClientsOf, botaoConfigured, createBotaoRequest, resolveBotaoRequest } from "@/lib/botao/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  if (employee.viewerOf || employee.docsOnly) {
    return NextResponse.json({ error: "Este perfil não pode acionar o botão." }, { status: 403 });
  }
  if (!botaoConfigured) {
    return NextResponse.json({ error: "Armazenamento não configurado neste ambiente." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const clientValue = typeof body.client === "string" ? body.client : "";
  const solutions = (Array.isArray(body.solutions) ? body.solutions : [])
    .map((s) => oneLine(s, BOTAO_SOLUTION_MAX))
    .filter(Boolean);
  const problem = typeof body.problem === "string" ? body.problem : "";
  const error = validateBotaoDraft({ client: clientValue, problem, solutions });
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (solutions.length > BOTAO_MAX_SOLUTIONS) {
    return NextResponse.json({ error: "No máximo duas sugestões." }, { status: 400 });
  }

  let client: { slug: string; title: string } | null = null;
  if (clientValue !== BOTAO_INTERNAL) {
    const mine = await botaoClientsOf(employee.name);
    const found = mine.find((c) => c.slug === clientValue);
    if (!found) {
      return NextResponse.json({ error: "Só podes escolher um dos teus clientes." }, { status: 403 });
    }
    client = { slug: found.slug, title: found.title };
  }

  const record = await createBotaoRequest({
    username: employee.username,
    name: employee.name,
    dept: employee.dept,
    client,
    problem,
    solutions,
    meeting: body.meeting === true,
  });
  return NextResponse.json({ ok: true, request: record });
}

export async function PATCH(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  if (!employee.isAdmin) {
    return NextResponse.json({ error: "Só a direção fecha pedidos." }, { status: 403 });
  }
  if (!botaoConfigured) {
    return NextResponse.json({ error: "Armazenamento não configurado neste ambiente." }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Falta o pedido." }, { status: 400 });
  const reply = typeof body.reply === "string" ? body.reply : "";
  const updated = await resolveBotaoRequest(id, { name: employee.name }, reply);
  if (!updated) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, request: updated });
}
