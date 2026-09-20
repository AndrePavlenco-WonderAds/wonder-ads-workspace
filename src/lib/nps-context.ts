// Constrói o contexto do inquérito NPS (v77.38) — ver nps-context-shared.ts
// para o porquê. Este é o lado do SERVIDOR: lê o KV (índice + snapshot do
// relatório, roadmap atual + arquivo) e devolve um resumo serializável que
// o painel do formulário (browser) e a ficha interna do NPS consomem.
//
// Custo por chamada: 1 leitura do índice de relatórios + 1–3 snapshots
// (até encontrar um finalizado) + roadmap atual + arquivo. O formulário é
// aberto pelo cliente uma vez por ciclo; não há razão para cache.

import { getReport, listReports } from "@/lib/report/report-store";
import { formatValue, metricDelta } from "@/lib/report/report-format";
import {
  gbpLeadTotal,
  isGbpChannelKey,
  websiteLeadTotal,
  type MonthlyReportSnapshot,
  type ReportMetric,
} from "@/lib/report/report-types";
import {
  getCurrentRoadmap,
  listArchivedRoadmaps,
  type Roadmap,
  type RoadmapPillar,
} from "@/lib/roadmap-store";
import type { PublicLang } from "@/lib/public-i18n";
import {
  NPS_WORK_WINDOW_DAYS,
  lisbonMonthKey,
  monthLabel,
  periodLabel,
  type NpsDoneAction,
  type NpsReportDigest,
  type NpsSurveyContext,
  type NpsWorkDigest,
  type NpsWorkMonth,
} from "./nps-context-shared";

/** Quantos relatórios (do mais recente para trás) se tentam até encontrar
 *  um finalizado. Um rascunho do mês em curso não pode tapar o relatório
 *  fechado do mês anterior. */
const MAX_REPORT_PROBES = 3;

/** A mesma regra da página pública do relatório: só um relatório finalizado
 *  (ou «sent», nos antigos sem finalizedAt) chega ao cliente. */
export function isReportLive(
  snap: Pick<MonthlyReportSnapshot, "status" | "finalizedAt">,
): boolean {
  return snap.status === "sent" || Boolean(snap.finalizedAt);
}

/** O relatório mensal mais recente que o cliente pode ver, ou null. */
export async function getLatestLiveReport(
  slug: string,
): Promise<MonthlyReportSnapshot | null> {
  const index = await listReports(slug); // mais recente primeiro
  for (const entry of index.slice(0, MAX_REPORT_PROBES)) {
    const snap = await getReport(slug, entry.period);
    if (snap && isReportLive(snap)) return snap;
  }
  return null;
}

/** O topo do relatório, em resumo — os MESMOS números e as MESMAS regras do
 *  documento (ReportDocument, variante cliente): zero e pendentes não se
 *  mostram, e um mês parcial não traz comparações. */
export function buildReportDigest(
  snap: MonthlyReportSnapshot,
  lang: PublicLang,
): NpsReportDigest {
  const t = (p: string, e: string) => (lang === "pt" ? p : e);
  const partial = Boolean(snap.coverage?.partial);
  const showDeltas = !partial;
  const hidden = new Set(snap.hiddenSections ?? []);

  const execSummary = hidden.has("exec")
    ? []
    : showDeltas
      ? snap.execSummary
      : snap.execSummary.filter((b) => !b.includes("%"));

  const leadWebsite =
    snap.leads.website ?? websiteLeadTotal(snap.leads.channels);
  const leadGbp = snap.leads.gbp ?? gbpLeadTotal(snap.leads.channels);
  const hasGbp = snap.leads.channels.some((c) => isGbpChannelKey(c.key));

  const defs: { label: string; m: ReportMetric }[] = [
    { label: t("Leads do website", "Website leads"), m: leadWebsite },
    ...(hasGbp
      ? [
          {
            label: t("Contactos Ficha Google", "Google listing contacts"),
            m: leadGbp,
          },
        ]
      : []),
    { label: t("Utilizadores orgânicos", "Organic users"), m: snap.organic.users },
    { label: t("Clicks no Google", "Google clicks"), m: snap.gsc.clicks },
    { label: t("Posição média", "Avg. position"), m: snap.gsc.position },
  ];

  const kpis = defs
    .filter((k) => (k.m.value !== null && k.m.value !== 0) || k.m.manualNa)
    .map((k) => ({
      label: k.label,
      value: formatValue(k.m, lang),
      delta: showDeltas && !k.m.manualNa ? metricDelta(k.m, lang) : null,
    }));

  const days = snap.coverage?.days;
  const label =
    partial && typeof days === "number"
      ? `${periodLabel(snap.period, lang)} ${t(`(parcial · 1–${days})`, `(partial · 1–${days})`)}`
      : periodLabel(snap.period, lang);

  return {
    period: snap.period,
    periodLabel: label,
    partial,
    generatedAt: snap.generatedAt,
    finalizedAt: snap.finalizedAt ?? null,
    consultantName: snap.consultant?.name ?? "",
    highlights: execSummary.slice(0, 5),
    kpis,
    href: `/${snap.slug}/preview/report/${snap.period}`,
  };
}

/** As tarefas marcadas «Implemented» nos últimos 3 meses — do roadmap
 *  atual E dos arquivados (um roadmap regenerado há um mês empurrou o
 *  trabalho anterior para o arquivo, e esse trabalho conta). null quando o
 *  cliente nunca teve roadmap. */
export async function getWorkDigest(
  slug: string,
  lang: PublicLang,
  now: number = Date.now(),
): Promise<NpsWorkDigest | null> {
  const [current, archived] = await Promise.all([
    getCurrentRoadmap(slug),
    listArchivedRoadmaps(slug),
  ]);
  if (!current && archived.length === 0) return null;

  const since = now - NPS_WORK_WINDOW_DAYS * 86_400_000;
  const seen = new Set<string>();
  const items: NpsDoneAction[] = [];
  const roadmaps: (Roadmap | null)[] = [current, ...archived];
  for (const rm of roadmaps) {
    if (!rm || !Array.isArray(rm.tasks)) continue;
    for (const task of rm.tasks) {
      if (task.status !== "implemented") continue;
      const at =
        typeof task.statusChangedAt === "number" ? task.statusChangedAt : 0;
      // Um relógio adiantado no browser de quem marcou não pode pôr uma
      // tarefa «no futuro»; um dia de folga chega.
      if (at < since || at > now + 86_400_000) continue;
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      items.push({
        id: task.id,
        title: task.title,
        pillar: task.pillar,
        doneAt: at,
        week: task.week,
      });
    }
  }
  items.sort((a, b) => b.doneAt - a.doneAt);

  const byMonth = new Map<string, NpsDoneAction[]>();
  for (const it of items) {
    const key = lisbonMonthKey(it.doneAt);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(it);
  }
  const months: NpsWorkMonth[] = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({ key, label: monthLabel(key, lang), items: list }));

  const pillarCount = new Map<RoadmapPillar, number>();
  for (const it of items) {
    pillarCount.set(it.pillar, (pillarCount.get(it.pillar) ?? 0) + 1);
  }
  const byPillar = [...pillarCount.entries()]
    .map(([pillar, count]) => ({ pillar, count }))
    .sort((a, b) => b.count - a.count);

  return {
    since,
    until: now,
    total: items.length,
    byPillar,
    months,
    roadmapHref: current ? `/${slug}/preview/roadmap` : null,
  };
}

/** Tudo o que o formulário NPS mostra ao lado das perguntas. Nunca lança:
 *  um KV em baixo tira o painel, não o inquérito. */
export async function getNpsSurveyContext(
  slug: string,
  lang: PublicLang,
  now: number = Date.now(),
): Promise<NpsSurveyContext> {
  const [snap, work] = await Promise.all([
    getLatestLiveReport(slug).catch((err) => {
      console.error("nps-context: report read failed:", err);
      return null;
    }),
    getWorkDigest(slug, lang, now).catch((err) => {
      console.error("nps-context: roadmap read failed:", err);
      return null;
    }),
  ]);
  return {
    report: snap ? buildReportDigest(snap, lang) : null,
    work,
  };
}
