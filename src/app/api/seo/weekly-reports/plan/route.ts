// POST /api/seo/weekly-reports/plan
//
// Passo 1 do estúdio: parte da CARTEIRA do consultor autenticado, cruza-a com
// os daily updates da semana e vai ao roadmap de cada cliente buscar o que
// está programado para a semana seguinte. NÃO chama o modelo — é tudo
// determinístico, responde em menos de um segundo.
//
// A carteira manda no número de mensagens (v76.74): o weekly report é uma
// mensagem por grupo de cliente do consultor, e um cliente esquecido no texto
// tem de aparecer com aviso — não desaparecer em silêncio. O consultor
// resolve-se por resolveConsultant, não pelo campo em cache de
// getSeoClients(): a cache é de 1 hora e uma passagem de carteira não pode
// mandar mensagens em nome da pessoa errada durante esse tempo.
//
// Separar isto da escrita (v76.73) é o que permite ao consultor ver o
// agrupamento imediatamente: que clientes foram apanhados, quais não batem com
// a carteira, quem tem a semana seguinte por preencher. Antes, dez chamadas ao
// modelo corriam às escuras atrás de um spinner e um nome mal escrito só
// aparecia no fim.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getSeoClients } from "@/lib/notion";
import { resolveConsultant } from "@/lib/client-overrides";
import { buildWeeklyPlan } from "@/lib/seo-tools/weekly-plan";
import type { DailyBlock } from "@/lib/seo-tools/daily-updates";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Teto de clientes por geração. Um daily update mal colado (o dia inteiro do
 *  departamento, por exemplo) não pode disparar cinquenta chamadas ao modelo
 *  no passo seguinte. */
const MAX_CLIENTS = 20;

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!editableDepts(employee).includes("seo")) {
    return NextResponse.json(
      { error: "Só a equipa de SEO pode gerar weekly reports." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const b = (body ?? {}) as { blocks?: unknown };

  const blocks: DailyBlock[] = Array.isArray(b.blocks)
    ? b.blocks
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return {
            label: typeof o.label === "string" ? o.label.slice(0, 40) : "",
            text: typeof o.text === "string" ? o.text.slice(0, 20_000) : "",
          };
        })
        .filter((x) => x.text.trim())
    : [];
  if (blocks.length === 0) {
    return NextResponse.json(
      { error: "Cola pelo menos um dia de daily updates." },
      { status: 400 },
    );
  }

  const roster = (await getSeoClients().catch(() => [])).map((c) => ({
    slug: c.slug,
    title: c.title,
    consultant: resolveConsultant(c.slug, c.consultant),
  }));
  const portfolio = roster.filter((c) => c.consultant === employee.name);
  const all = await buildWeeklyPlan(blocks, roster, portfolio, employee.name);

  if (all.length === 0) {
    // Só possível sem carteira própria (admin) e sem nenhum nome no texto.
    return NextResponse.json(
      {
        error:
          "Não encontrei nenhum cliente nos daily updates. Escreve o nome de cada cliente numa linha própria (ex.: «White Clinic:» ou só «White Clinic») e o trabalho dele por baixo.",
      },
      { status: 400 },
    );
  }

  const clients = all.slice(0, MAX_CLIENTS);

  return NextResponse.json({
    ok: true,
    generatedAt: Date.now(),
    daysUsed: blocks.length,
    portfolioCount: portfolio.length,
    clients,
    skipped: Math.max(0, all.length - clients.length),
  });
}
