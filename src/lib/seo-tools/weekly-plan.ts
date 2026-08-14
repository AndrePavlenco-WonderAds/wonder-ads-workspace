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

function warningsFor(
  client: ParsedClientWork,
  roadmap: NextWeekPlan | null,
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
 *  para escrever a mensagem — menos a mensagem. Os roadmaps são lidos em
 *  paralelo e um que falhe não derruba os outros. */
export async function buildWeeklyPlan(
  blocks: DailyBlock[],
  roster: { slug: string; title: string }[],
  now: number = Date.now(),
): Promise<WeeklyPlanClient[]> {
  const parsed = parseDailyUpdates(blocks, roster);

  return Promise.all(
    parsed.map(async (c): Promise<WeeklyPlanClient> => {
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
        lang: reportLangFor(c.slug),
        items: c.items,
        roadmap,
        warnings: warningsFor(c, roadmap),
      };
    }),
  );
}
