// POST /api/seo/weekly-reports/message
//
// Passo 2 do estúdio: escreve a mensagem de UM cliente. Uma chamada por
// cliente, disparadas em paralelo pelo browser — assim cada cartão fica pronto
// quando fica, um erro não arrasta os outros, e regenerar um cliente não
// obriga a regenerar a carteira toda.
//
// O QUE O MODELO DECIDE E O QUE O CÓDIGO DECIDE:
//   • modelo → os BULLETS. Traduzir «instalado plugin de tradução» para o
//     benefício que o cliente percebe é o que ele faz bem.
//   • código → o MOLDE. Saudação, linhas com emoji, fecho, ordem, língua.
//     Ver weekly-report-format.ts: pedir ao modelo que repita o molde é
//     pedir-lhe para acertar em algo que não tem de decidir.
//
// O roadmap é RELIDO aqui a partir do slug — nunca se aceita a lista de
// tarefas que o browser mandou. O «na próxima semana» é um compromisso que vai
// para o cliente; a fonte tem de ser o roadmap no servidor.

import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { readNextWeek } from "@/lib/seo-tools/weekly-plan";
import {
  buildWeeklyMessage,
  reportLangFor,
  scaffoldFor,
  type ReportLang,
} from "@/lib/weekly-report-format";

export const runtime = "nodejs";
export const maxDuration = 120;

// Sonnet: a mensagem vai direta para um cliente que paga — a qualidade do
// português (ou do inglês) vale mais do que os cêntimos poupados com um modelo
// mais pequeno.
const MODEL = "claude-sonnet-4-6";

const BulletsSchema = z.object({
  done: z
    .array(z.string().min(3).max(300))
    .min(1)
    .max(12)
    .describe("What was done this week, one bullet per line, no bullet marker"),
  next: z
    .array(z.string().min(3).max(300))
    .max(12)
    .describe(
      "What is planned for next week, from the roadmap tasks only. Empty array if there are none.",
    ),
});

/** Sem daily updates deste cliente só há uma lista para escrever: a da
 *  semana seguinte, a partir do roadmap. O «o que foi feito» é a linha
 *  neutra do molde — pedir «done» ao modelo aqui era pedir-lhe para
 *  inventar trabalho. */
const NextOnlySchema = z.object({
  next: z
    .array(z.string().min(3).max(300))
    .min(1)
    .max(12)
    .describe(
      "What is planned for next week, rewritten from the roadmap tasks, one bullet per line, no bullet marker",
    ),
});

function systemPrompt(lang: ReportLang): string {
  const s = scaffoldFor(lang);
  return [
    `You are a Portuguese SEO consultant writing the weekly status bullets for a client. Write every bullet in ${s.promptLanguage}.`,
    "Tone: professional but warm and close — the client reads this in their WhatsApp group.",
    "Translate technical SEO work into plain benefits a non-technical business owner understands. Never leave raw jargon ('schema', 'meta tags', 'crawl', 'H1', 'plugin', 'backlink') — always say the practical effect on their business.",
    "Never invent work and never invent commitments. Every bullet must come from the lists you are given.",
    "ABSOLUTE RULE: the message is always positive. Never mention work that is unfinished, missing, late, pending or partial. Never write 'not yet', 'we could not', 'still missing', 'pending'. Only what is DONE and what comes NEXT.",
    "You output ONLY the bullets. The greeting, the section headings, the emojis and the sign-off are added by the app — do not write them, do not repeat them, do not add a bullet marker.",
  ].join(" ");
}

function userPrompt(
  clientTitle: string,
  items: { day: string; text: string }[],
  nextWeekTasks: string[],
  roadmapWeek: number | null,
  instructions: string,
): string {
  const done = items.map((i) => `- (${i.day}) ${i.text}`).join("\n");
  const next =
    nextWeekTasks.length > 0
      ? nextWeekTasks.map((t) => `- ${t}`).join("\n")
      : "(nothing scheduled)";
  const extra = instructions
    ? `\n\nExtra instructions from the consultant (follow them, but NEVER break the rules above):\n${instructions}`
    : "";

  return `Client: ${clientTitle}${roadmapWeek ? `\nRoadmap week now: ${roadmapWeek}` : ""}

Produce two lists of bullets.

**done** — the week's work, merged and rewritten as client-facing benefits:
- MERGE similar tasks into a single bullet. The work below comes from several days and repeats — this is a summary of the WEEK, not a daily log. Never mention days or dates.
- Affirmative, first person plural ("Configurámos…", "Publicámos…" / "We set up…", "We published…").
- Aim for 4–8 bullets. Never drop real work just to be short.

**next** — what is planned, taken ONLY from the scheduled roadmap work below:
- Affirmative statement of intent ("Vamos otimizar…", "Iremos publicar…" / "We will optimise…", "We will publish…").
- If the scheduled list is empty, return an EMPTY array — do not invent anything. The app writes a neutral line in that case.${extra}

=== DONE THIS WEEK (from the consultant's daily updates — base of the bullets) ===
${done}

=== SCHEDULED FOR NEXT WEEK (from this client's SEO roadmap) ===
${next}`;
}

/** O prompt do caminho sem daily updates: só se escreve a semana seguinte. */
function nextOnlyPrompt(
  clientTitle: string,
  nextWeekTasks: string[],
  roadmapWeek: number | null,
  instructions: string,
): string {
  const next = nextWeekTasks.map((t) => `- ${t}`).join("\n");
  const extra = instructions
    ? `\n\nExtra instructions from the consultant (follow them, but NEVER break the rules above):\n${instructions}`
    : "";

  return `Client: ${clientTitle}${roadmapWeek ? `\nRoadmap week now: ${roadmapWeek}` : ""}

There are no daily updates for this client this week — the app writes a neutral "we continued the planned work" line for the done section, so you must NOT write it.

Produce ONE list of bullets.

**next** — what is planned, taken ONLY from the scheduled roadmap work below:
- Affirmative statement of intent ("Vamos otimizar…", "Iremos publicar…" / "We will optimise…", "We will publish…").
- Rewrite each task as a benefit the client understands; merge tasks that belong together.${extra}

=== SCHEDULED FOR NEXT WEEK (from this client's SEO roadmap) ===
${next}`;
}

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não está configurada." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const b = (body ?? {}) as {
    slug?: unknown;
    title?: unknown;
    items?: unknown;
    instructions?: unknown;
  };

  const slug = typeof b.slug === "string" && b.slug ? b.slug : null;
  const title =
    typeof b.title === "string" && b.title.trim()
      ? b.title.trim().slice(0, 120)
      : null;
  const items = Array.isArray(b.items)
    ? b.items
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return {
            day: typeof o.day === "string" ? o.day.slice(0, 20) : "",
            text: typeof o.text === "string" ? o.text.slice(0, 600) : "",
          };
        })
        .filter((x) => x.text.trim())
        .slice(0, 120)
    : [];
  const instructions =
    typeof b.instructions === "string"
      ? b.instructions.trim().slice(0, 2000)
      : "";

  // Sem trabalho da semana a mensagem ainda sai — a carteira manda no número
  // de mensagens — mas só para um cliente a sério: é o slug que dá o roadmap
  // e a língua. Um nome que não resolveu e ainda por cima sem trabalho não
  // tem matéria nenhuma para uma mensagem.
  if (!title || (items.length === 0 && !slug)) {
    return NextResponse.json(
      { error: "Faltam o cliente ou o trabalho da semana." },
      { status: 400 },
    );
  }

  // O roadmap é sempre relido no servidor — o «na próxima semana» é um
  // compromisso, não pode vir do browser.
  const roadmap = slug ? await readNextWeek(slug).catch(() => null) : null;
  const lang = reportLangFor(slug);
  const nextTasks = roadmap?.tasks ?? [];

  try {
    // Três caminhos, do mais completo ao mais vazio:
    //   trabalho da semana        → modelo escreve «done» e «next»
    //   só roadmap                → modelo escreve só «next»; «done» é a
    //                               linha neutra do molde
    //   nem um nem outro          → não há nada para o modelo decidir; a
    //                               mensagem é o molde com as duas linhas
    //                               neutras, sem chamada nenhuma
    let done: string[] = [];
    let next: string[] = [];

    if (items.length > 0) {
      const { object } = await generateObject({
        model: anthropic(MODEL),
        schema: BulletsSchema,
        system: systemPrompt(lang),
        prompt: userPrompt(
          title,
          items,
          nextTasks,
          roadmap?.currentWeek ?? null,
          instructions,
        ),
      });
      done = object.done;
      // Uma tarefa inventada para a semana seguinte é a única coisa aqui sem
      // volta: sem roadmap, o molde escreve a linha neutra dele.
      next = nextTasks.length > 0 ? object.next : [];
    } else if (nextTasks.length > 0) {
      const { object } = await generateObject({
        model: anthropic(MODEL),
        schema: NextOnlySchema,
        system: systemPrompt(lang),
        prompt: nextOnlyPrompt(
          title,
          nextTasks,
          roadmap?.currentWeek ?? null,
          instructions,
        ),
      });
      next = object.next;
    }

    return NextResponse.json({
      ok: true,
      lang,
      done,
      next,
      roadmap,
      message: buildWeeklyMessage(lang, done, next),
    });
  } catch (err) {
    console.error(`weekly-reports/message: ${slug ?? title} falhou:`, err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Falha ao escrever a mensagem: ${err.message}`
            : "Falha ao escrever a mensagem.",
      },
      { status: 500 },
    );
  }
}
