// POST /api/seo/weekly-reports
//
// Recebe os daily updates da semana (um bloco por dia útil), descobre que
// clientes lá estão, e devolve UM weekly report por cliente, pronto a colar
// no grupo de WhatsApp desse cliente.
//
// DIVISÃO DE TRABALHO — o que é código e o que é modelo:
//
//   • QUE CLIENTES E QUE TAREFAS  → código (`parseDailyUpdates`). Formato
//     previsível, escrito pela casa. Um parser erra sempre igual e vê-se; um
//     modelo pode fundir dois clientes ou perder um bullet e ninguém dá por
//     isso até a mensagem estar no telemóvel do cliente errado.
//   • COMO SE DIZ AO CLIENTE      → modelo. Traduzir «Instalado plugin para
//     tradução do site» para o benefício que o cliente percebe é
//     exatamente o que um modelo faz bem.
//
// O «NA PRÓXIMA SEMANA» NÃO SE INVENTA. Os daily updates só dizem o que foi
// FEITO. A secção do que vem a seguir é lida do ROADMAP do cliente (coluna
// da semana seguinte) — a mesma fonte do weekly update antigo. Quando o
// cliente não tem roadmap, o cartão vem marcado a dizer isso e sem promessas
// escritas por ninguém: pôr um modelo a adivinhar compromissos numa mensagem
// que vai para o cliente é a única coisa aqui que não tem volta.
//
// Uma chamada ao modelo por cliente, em paralelo. Um prompt por cliente sai
// melhor do que um gigante a devolver JSON para todos, e o custo é o mesmo.

import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getSeoClients } from "@/lib/notion";
import {
  parseDailyUpdates,
  type DailyBlock,
  type ParsedClientWork,
} from "@/lib/seo-tools/daily-updates";
import {
  currentWeekIndex,
  getCurrentRoadmap,
  type RoadmapTask,
} from "@/lib/roadmap-store";

export const runtime = "nodejs";
export const maxDuration = 300;

// Sonnet: a mensagem vai direta para um cliente que paga — a qualidade do
// português vale mais do que os cêntimos poupados com um modelo mais pequeno.
const MODEL = "claude-sonnet-4-6";

/** Teto de clientes por geração. Um daily update mal colado (o dia inteiro
 *  do departamento, por exemplo) não pode disparar cinquenta chamadas. */
const MAX_CLIENTS = 20;

export type WeeklyReportCard = {
  slug: string | null;
  title: string;
  rawName: string;
  message: string;
  /** Tarefas lidas dos daily updates, para o consultor conferir a origem. */
  source: { day: string; text: string }[];
  /** O que o roadmap tinha para a semana seguinte. */
  nextWeek: string[];
  /** Avisos honestos que a UI mostra no cartão. */
  warnings: string[];
};

function describeTask(t: RoadmapTask): string {
  const desc = t.description?.trim();
  return desc ? `${t.title} — ${desc}` : t.title;
}

const SYSTEM = [
  "És um consultor de SEO português a escrever uma mensagem de WhatsApp para o grupo de um cliente.",
  "Escreves SEMPRE em português de Portugal, num tom profissional mas próximo e simpático.",
  "Traduzes tarefas técnicas de SEO para benefícios simples que um cliente sem conhecimentos técnicos percebe — nada de jargão cru ('schema', 'meta tags', 'crawl', 'H1', 'plugin'); explica sempre o efeito prático para o negócio dele.",
  "Nunca inventas trabalho nem compromissos que não estejam nas listas fornecidas.",
  "REGRA ABSOLUTA: a mensagem é SEMPRE positiva. NUNCA mencionas trabalho por concluir, em falta, atrasado, pendente ou parcial. NUNCA usas 'ainda não', 'não foi possível', 'em falta', 'por concluir', 'pendente'. Falas apenas do que JÁ foi concluído e do que vai ser feito a seguir.",
].join(" ");

function buildPrompt(
  client: ParsedClientWork,
  nextWeek: string[],
  instructions: string,
): string {
  const done = client.items.map((i) => `- (${i.day}) ${i.text}`).join("\n");
  const next =
    nextWeek.length > 0
      ? nextWeek.map((t) => `- ${t}`).join("\n")
      : "(nenhuma tarefa registada)";
  const extra = instructions
    ? `\n\nInstruções adicionais do consultor (segue-as, MAS nunca quebrando as regras acima):\n${instructions}`
    : "";

  return `Cliente: ${client.title}

Compõe a mensagem de ponto de situação semanal (SEO) para enviar ao grupo de WhatsApp deste cliente.

Usa EXATAMENTE este formato e estrutura (mantém os emojis e as linhas fixas tal e qual):

Boa tarde!

Segue o ponto de situação desta semana (SEO):

✅ O que foi feito esta semana:
• <bullet>
• <bullet>

📅 Na próxima semana:
• <bullet>
• <bullet>

Qualquer dúvida, estamos por aqui!

Obrigado!

Regras:
- Cada bullet é uma frase clara, orientada ao benefício para o cliente, sem jargão técnico.
- FUNDE tarefas semelhantes num só bullet. O trabalho abaixo vem de vários dias da semana e repete-se — a mensagem é um resumo da SEMANA, não uma lista diária. Não menciones dias nem datas.
- "O que foi feito esta semana" usa tom afirmativo na primeira pessoa do plural ("Configurámos…", "Publicámos…", "Otimizámos…").
- "Na próxima semana" usa tom afirmativo de intenção ("Vamos otimizar…", "Iremos publicar…") e sai APENAS da lista de trabalho programado abaixo.
- Se a lista de trabalho programado estiver vazia, escreve um único bullet neutro sobre a continuidade dos trabalhos de SEO previstos, sem prometer nada em concreto.
- Devolve APENAS o texto da mensagem, sem comentários nem marcações de código.${extra}

=== FEITO ESTA SEMANA (dos daily updates — usar como base dos bullets) ===
${done}

=== PROGRAMADO PARA A PRÓXIMA SEMANA (do roadmap deste cliente) ===
${next}`;
}

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
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
  const b = (body ?? {}) as { blocks?: unknown; instructions?: unknown };

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
  const instructions =
    typeof b.instructions === "string" ? b.instructions.trim().slice(0, 2000) : "";

  const roster = await getSeoClients().catch(() => []);
  const parsed = parseDailyUpdates(
    blocks,
    roster.map((c) => ({ slug: c.slug, title: c.title })),
  );
  if (parsed.length === 0) {
    return NextResponse.json(
      {
        error:
          "Não encontrei nenhum cliente nos daily updates. Cada cliente tem de estar numa linha própria terminada em dois pontos (ex.: «White Clinic:») e o trabalho dele por baixo.",
      },
      { status: 400 },
    );
  }
  const clients = parsed.slice(0, MAX_CLIENTS);

  // O que cada cliente tem programado para a semana seguinte. Leitura por
  // cliente, em paralelo — e um roadmap em falta não derruba a geração.
  const nextWeekByKey = new Map<string, string[]>();
  await Promise.all(
    clients.map(async (c) => {
      if (!c.slug) return;
      try {
        const roadmap = await getCurrentRoadmap(c.slug);
        if (!roadmap) return;
        const next = currentWeekIndex(roadmap) + 1;
        nextWeekByKey.set(
          c.slug,
          roadmap.tasks
            .filter((t) => t.week === next)
            .sort((a, b) => a.order - b.order)
            .map(describeTask),
        );
      } catch (err) {
        console.error(`weekly-reports: roadmap de ${c.slug} falhou:`, err);
      }
    }),
  );

  const cards = await Promise.all(
    clients.map(async (c): Promise<WeeklyReportCard> => {
      const nextWeek = c.slug ? (nextWeekByKey.get(c.slug) ?? []) : [];
      const warnings: string[] = [];
      if (!c.slug) {
        warnings.push(
          `«${c.rawName}» não corresponde a nenhum cliente da carteira SEO — confirma o nome antes de enviar.`,
        );
      } else if (nextWeek.length === 0) {
        warnings.push(
          "Sem tarefas no roadmap para a próxima semana — o «Na próxima semana» ficou genérico. Preenche o roadmap para a mensagem ser concreta.",
        );
      }
      try {
        const { text } = await generateText({
          model: anthropic(MODEL),
          system: SYSTEM,
          prompt: buildPrompt(c, nextWeek, instructions),
        });
        return {
          slug: c.slug,
          title: c.title,
          rawName: c.rawName,
          message: text.trim(),
          source: c.items,
          nextWeek,
          warnings,
        };
      } catch (err) {
        return {
          slug: c.slug,
          title: c.title,
          rawName: c.rawName,
          message: "",
          source: c.items,
          nextWeek,
          warnings: [
            ...warnings,
            `Falha ao gerar: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    }),
  );

  return NextResponse.json({
    ok: true,
    generatedAt: Date.now(),
    cards,
    skipped: Math.max(0, parsed.length - clients.length),
  });
}
