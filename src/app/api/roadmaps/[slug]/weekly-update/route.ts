// Generate a client-facing "Weekly Update" — a short, WhatsApp-style
// message (European Portuguese) the consultant can copy and send to the
// client, summarising what got done THIS week and what's planned for
// NEXT week, pulled straight from the client's current SEO roadmap.
//
// Grounding: the current roadmap in KV. We bucket tasks into
//   - implemented this week  (status implemented + in the current week
//     column OR flipped to implemented during the current week window)
//   - pending this week       (current week column, not yet implemented)
//   - planned next week        (next week column, any status)
// and let Claude rephrase the technical task titles into friendly,
// non-technical PT-PT bullets following a fixed template. Read-only —
// nothing is written back to KV.

import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { getClientBySlug } from "@/lib/notion";
import {
  currentWeekIndex,
  getCurrentRoadmap,
  weekStartDate,
  type RoadmapTask,
} from "@/lib/roadmap-store";

export const runtime = "nodejs";
export const maxDuration = 60;

// Sonnet — the message goes straight to a paying client, so the
// Portuguese phrasing quality matters more than the few cents saved by
// Haiku. Typical wall-clock 5–12s for this small rephrase.
const MODEL = "claude-sonnet-4-6";

const DAY_MS = 1000 * 60 * 60 * 24;

function clampWeek(w: number): number {
  if (w < 1) return 1;
  if (w > 12) return 12;
  return w;
}

function describeTask(t: RoadmapTask): string {
  const desc = t.description?.trim();
  return desc ? `${t.title} — ${desc}` : t.title;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 400 },
    );
  }

  const [client, roadmap] = await Promise.all([
    getClientBySlug(slug).catch(() => null),
    getCurrentRoadmap(slug),
  ]);

  if (!roadmap || roadmap.tasks.length === 0) {
    return NextResponse.json(
      { error: "Este cliente ainda não tem um roadmap com tarefas." },
      { status: 400 },
    );
  }

  const clientName = client?.title ?? slug;
  const rawWeek = currentWeekIndex(roadmap);
  const week = clampWeek(rawWeek);
  const nextWeek = week + 1;

  // Current-week window [Monday 00:00, +7 days) used to catch tasks that
  // were flipped to "implemented" during this week even if they live in
  // an earlier column.
  const weekStartIso = weekStartDate(roadmap, week);
  const windowStart = new Date(`${weekStartIso}T00:00:00Z`).getTime();
  const windowEnd = windowStart + 7 * DAY_MS;
  const inThisWeekWindow = (ms: number) =>
    Number.isFinite(ms) && ms >= windowStart && ms < windowEnd;

  const implementedThisWeek: RoadmapTask[] = [];
  const seenImplemented = new Set<string>();
  for (const t of roadmap.tasks) {
    if (t.status !== "implemented") continue;
    if (t.week === week || inThisWeekWindow(t.statusChangedAt)) {
      if (!seenImplemented.has(t.id)) {
        seenImplemented.add(t.id);
        implementedThisWeek.push(t);
      }
    }
  }
  const pendingThisWeek = roadmap.tasks.filter(
    (t) => t.week === week && t.status !== "implemented",
  );
  const plannedNextWeek = roadmap.tasks.filter((t) => t.week === nextWeek);

  const sortByOrder = (a: RoadmapTask, b: RoadmapTask) => a.order - b.order;
  implementedThisWeek.sort(sortByOrder);
  pendingThisWeek.sort(sortByOrder);
  plannedNextWeek.sort(sortByOrder);

  const listOrNone = (tasks: RoadmapTask[]) =>
    tasks.length > 0
      ? tasks.map((t) => `- ${describeTask(t)}`).join("\n")
      : "(nenhuma)";

  const system = [
    "És um consultor de SEO português a escrever uma mensagem curta de WhatsApp para um cliente.",
    "Escreves SEMPRE em português de Portugal, num tom profissional mas próximo e simpático.",
    "Traduzes tarefas técnicas de SEO para benefícios simples que um cliente sem conhecimentos técnicos percebe — nada de jargão (sem 'schema', 'meta tags' cru, 'crawl', etc.; explica o efeito prático).",
    "Nunca inventas trabalho que não está nas listas fornecidas.",
  ].join(" ");

  const prompt = `Cliente: ${clientName}
Semana atual do roadmap: ${week} de 12.

Compõe a mensagem de ponto de situação semanal (SEO) para enviar ao cliente por WhatsApp.

Usa EXATAMENTE este formato e estrutura (mantém os emojis e as linhas fixas tal e qual):

Boa tarde!

Segue o ponto de situação desta semana (SEO):

✅ O que foi feito esta semana:
•⁠  ⁠<bullet>
•⁠  ⁠<bullet>

📅 Na próxima semana:
•⁠  ⁠<bullet>
•⁠  ⁠<bullet>

Qualquer dúvida, estamos por aqui!

Obrigada!

Regras:
- Cada bullet é uma frase clara, orientada ao benefício para o cliente, sem jargão técnico.
- Agrupa/funde tarefas semelhantes num só bullet quando fizer sentido (não repitas).
- As tarefas "PENDENTES desta semana" (abaixo) NÃO levam um bullet próprio: se forem relevantes, menciona-as com um tom suave dentro da secção "O que foi feito esta semana" (ex.: "Ainda não foi possível concluir todos os ajustes, mas assim que estiverem prontos voltamos a enviar para validação."). Se não forem relevantes para o cliente, ignora-as.
- Se uma secção não tiver tarefas, escreve um único bullet honesto e adequado (ex.: na próxima semana, "Damos continuidade ao trabalho planeado.").
- Devolve APENAS o texto da mensagem, sem comentários nem marcações de código.

=== FEITO ESTA SEMANA (status: implementado) ===
${listOrNone(implementedThisWeek)}

=== PENDENTE DESTA SEMANA (ainda não implementado — usar como ressalva suave, não como bullets) ===
${listOrNone(pendingThisWeek)}

=== PROGRAMADO PARA A PRÓXIMA SEMANA ===
${listOrNone(plannedNextWeek)}`;

  try {
    const { text } = await generateText({
      model: anthropic(MODEL),
      system,
      prompt,
    });
    const message = text.trim();
    return NextResponse.json({
      message,
      week,
      counts: {
        implemented: implementedThisWeek.length,
        pending: pendingThisWeek.length,
        nextWeek: plannedNextWeek.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Falha ao gerar o weekly update: ${err.message}`
            : "Falha ao gerar o weekly update.",
      },
      { status: 500 },
    );
  }
}
