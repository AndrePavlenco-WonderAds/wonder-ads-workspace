// O PLANO do weekly report: o que a app sabe ANTES de chamar o modelo.
//
// O fluxo do estúdio é sempre o mesmo, e é este ficheiro que faz os três
// primeiros passos:
//
//   daily updates do consultor
//     → agrupar por cliente          (parseDailyUpdates, determinístico)
//     → ir ao roadmap de cada cliente
//     → ler o que está programado para a SEMANA SEGUINTE
//     → [só então] escrever a mensagem  ← isso é o passo do modelo, noutro sítio
//
// Separar o plano da escrita (v76.73) tem duas razões práticas. A primeira é
// que o consultor vê o agrupamento no ecrã em menos de um segundo — que
// clientes foram apanhados, quais não bateram com a carteira, quem tem a
// semana seguinte por preencher — em vez de ficar a olhar para um spinner
// enquanto dez chamadas ao modelo correm às escuras. A segunda é que a
// escrita passa a ser por cliente: um cliente que falhe regenera-se sozinho,
// sem arrastar os outros.

import { getCurrentRoadmap, taskCoversWeek, currentWeekIndex, roadmapWeeks, type RoadmapTask } from "@/lib/roadmap-store";
import { reportLangFor, type ReportLang } from "@/lib/weekly-report-format";
import {
  parseDailyUpdates,
  type DailyBlock,
  type MatchVia,
  type ParsedClientWork,
} from "./daily-updates";

/** O que o roadmap do cliente diz sobre a semana que vem. */
export type NextWeekPlan = {
  /** Semana em que o roadmap está HOJE (1-indexada). */
  currentWeek: number;
  /** A semana a que o «na próxima semana» diz respeito. */
  nextWeek: number;
  totalWeeks: number;
  /** Tarefas programadas, já em texto («título — descrição»). */
  tasks: string[];
};

export type WeeklyPlanClient = {
  /** Chave estável para a UI: o slug, ou o nome cru quando não resolveu. */
  key: string;
  slug: string | null;
  title: string;
  rawName: string;
  /** Todas as grafias com que apareceu na semana («A. Domingos», «admingos»). */
  rawNames: string[];
  /** Como o nome foi resolvido — `fuzzy` significa que a app aproximou. */
  via: MatchVia;
  /** Cliente da carteira do consultor autenticado. É a carteira que manda no
   *  número de mensagens: um cliente dela tem SEMPRE cartão, com ou sem
   *  trabalho detetado nos daily updates. */
  inPortfolio: boolean;
  lang: ReportLang;
  /** O trabalho da semana, tal como saiu dos daily updates. */
  items: { day: string; text: string }[];
  roadmap: NextWeekPlan | null;
  warnings: string[];
};

export function describeTask(t: RoadmapTask): string {
  const desc = t.description?.trim();
  return desc ? `${t.title} — ${desc}` : t.title;
}

/** O que o cliente tem programado para a semana seguinte, lido do roadmap.
 *
 *  Duas decisões que valem a pena dizer em voz alta:
 *  • Usa-se `taskCoversWeek`, não `t.week === n`. Uma tarefa de três semanas
 *    que começou na semana 4 ESTÁ programada para a semana 5 — filtrar pela
 *    coluna de início deixava-a de fora e a mensagem prometia menos do que
 *    o roadmap tem.
 *  • Tarefas já implementadas não entram. Prometer ao cliente, como trabalho
 *    da semana que vem, algo que já está feito é dar a semana por vazia. */
export async function readNextWeek(
  slug: string,
  now: number = Date.now(),
): Promise<NextWeekPlan | null> {
  const roadmap = await getCurrentRoadmap(slug);
  if (!roadmap) return null;
  const total = roadmapWeeks(roadmap);
  const currentWeek = Math.min(Math.max(currentWeekIndex(roadmap, now), 1), total);
  const nextWeek = currentWeek + 1;
  const tasks = roadmap.tasks
    .filter((t) => taskCoversWeek(t, nextWeek) && t.status !== "implemented")
    .sort((a, b) => a.week - b.week || a.order - b.order)
    .map(describeTask);
  return { currentWeek, nextWeek, totalWeeks: total, tasks };
}

/** Um cliente do plano ANTES de se ir ler o roadmap — o que se sabe só de
 *  cruzar os daily updates com a carteira. */
type PlanSeed = Omit<ParsedClientWork, "slug"> & {
  slug: string | null;
  inPortfolio: boolean;
  /** Consultor responsável, para o aviso «isto é da carteira de X». */
  consultant: string | null;
};

function warningsFor(
  client: PlanSeed,
  roadmap: NextWeekPlan | null,
  viewerName: string | null,
): string[] {
  const out: string[] = [];
  if (!client.slug) {
    out.push(
      `«${client.rawName}» não corresponde a nenhum cliente da carteira SEO — confirma o nome antes de enviar. Sem cliente não há roadmap, por isso a próxima semana fica genérica.`,
    );
    return out;
  }
  // A app aproximou a grafia. Acerta quase sempre, mas quem envia a mensagem
  // é que responde por ela — por isso diz-se o que leu e o que assumiu.
  if (client.via === "fuzzy") {
    out.push(
      `Escrito como ${client.rawNames.map((n) => `«${n}»`).join(", ")} — assumi que é ${client.title}. Confirma antes de enviar.`,
    );
  }
  if (client.items.length === 0) {
    out.push(
      "Não encontrei trabalho deste cliente nos daily updates desta semana — a parte «o que foi feito» sai genérica. Se fizeste trabalho, acrescenta-o num dos dias e regenera.",
    );
  }
  if (!client.inPortfolio && viewerName) {
    out.push(
      `Este cliente é da carteira de ${client.consultant ?? "outro consultor"} — confirma que és tu a enviar esta mensagem.`,
    );
  }
  if (!roadmap) {
    out.push(
      "Este cliente ainda não tem roadmap — a próxima semana fica genérica. Cria o roadmap para a mensagem ser concreta.",
    );
  } else if (roadmap.tasks.length === 0) {
    out.push(
      `O roadmap não tem nada programado para a semana ${roadmap.nextWeek} — a próxima semana fica genérica. Preenche essa coluna para a mensagem ser concreta.`,
    );
  }
  return out;
}

/** Lê os daily updates da semana e devolve, por cliente, tudo o que é preciso
 *  para escrever a mensagem — menos a mensagem.
 *
 *  QUEM MANDA NO NÚMERO DE CARTÕES É A CARTEIRA, não o texto colado (v76.74).
 *  O weekly report é «uma mensagem por grupo de cliente do consultor»: um
 *  cliente da carteira sem trabalho detetado aparece na mesma, com aviso —
 *  esquecê-lo em silêncio era exatamente o erro que esta página existia para
 *  evitar. O texto colado só decide o CONTEÚDO da parte «o que foi feito».
 *
 *  Por cima da carteira entram os extras: clientes de outros consultores que
 *  apareceram no texto (com aviso de carteira alheia) e nomes que não bateram
 *  com carteira nenhuma (com o aviso amarelo de sempre). Quando não há
 *  carteira — um admin a espreitar — o plano volta a ser guiado só pelo
 *  texto, como antes.
 *
 *  Os roadmaps são lidos em paralelo e um que falhe não derruba os outros. */
export async function buildWeeklyPlan(
  blocks: DailyBlock[],
  roster: { slug: string; title: string; consultant?: string }[],
  portfolio: { slug: string; title: string }[],
  viewerName: string | null = null,
  now: number = Date.now(),
): Promise<WeeklyPlanClient[]> {
  const parsed = parseDailyUpdates(blocks, roster);
  const bySlug = new Map(
    parsed.filter((c) => c.slug).map((c) => [c.slug as string, c]),
  );
  const consultantOf = new Map(
    roster.map((c) => [c.slug, c.consultant ?? null]),
  );
  const portfolioSlugs = new Set(portfolio.map((c) => c.slug));
  const hasPortfolio = portfolio.length > 0;

  const seeds: PlanSeed[] = [];

  // 1 · A carteira do consultor, pela ordem dela — com ou sem trabalho.
  for (const c of portfolio) {
    const group = bySlug.get(c.slug);
    seeds.push({
      rawName: group?.rawName ?? c.title,
      rawNames: group?.rawNames ?? [],
      slug: c.slug,
      title: group?.title ?? c.title,
      via: group?.via ?? null,
      items: group?.items ?? [],
      inPortfolio: true,
      consultant: viewerName,
    });
  }

  // 2 · Extras que apareceram no texto: clientes fora da carteira e nomes
  //     que não resolveram. Sem carteira (admin), isto é o plano inteiro.
  for (const c of parsed) {
    if (c.slug && portfolioSlugs.has(c.slug)) continue;
    seeds.push({
      ...c,
      inPortfolio: !hasPortfolio,
      consultant: c.slug ? (consultantOf.get(c.slug) ?? null) : null,
    });
  }

  return Promise.all(
    seeds.map(async (c): Promise<WeeklyPlanClient> => {
      let roadmap: NextWeekPlan | null = null;
      if (c.slug) {
        try {
          roadmap = await readNextWeek(c.slug, now);
        } catch (err) {
          console.error(`weekly-plan: roadmap de ${c.slug} falhou:`, err);
        }
      }
      return {
        key: c.slug ?? `raw:${c.rawName}`,
        slug: c.slug,
        title: c.title,
        rawName: c.rawName,
        rawNames: c.rawNames,
        via: c.via,
        inPortfolio: c.inPortfolio,
        lang: reportLangFor(c.slug),
        items: c.items,
        roadmap,
        warnings: warningsFor(c, roadmap, hasPortfolio ? viewerName : null),
      };
    }),
  );
}
