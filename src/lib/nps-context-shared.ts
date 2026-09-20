// O CONTEXTO QUE ACOMPANHA O INQUÉRITO DE SATISFAÇÃO (v77.38).
//
// Quando o cliente do SEO DPT abre o formulário NPS, avalia um trabalho de
// 60 dias de que se lembra mal — e a nota sai da memória, não dos factos.
// O formulário passa a trazer ao lado, sem sair da página, as duas coisas
// que sustentam uma avaliação informada:
//
//   • o ÚLTIMO RELATÓRIO MENSAL finalizado (o mesmo documento que o cliente
//     já recebe pelo link público), em resumo — destaques + números — e o
//     documento completo a um clique;
//   • o TRABALHO CONCLUÍDO nos últimos 3 meses do roadmap SEO/GEO — as
//     tarefas marcadas como «Implemented», agrupadas por mês.
//
// Este módulo é PURO (sem @vercel/kv): tipos e rótulos partilhados entre o
// construtor no servidor (nps-context.ts) e o painel no browser
// (nps-context-dock.tsx). Só tipos são importados dos stores — apagam-se
// na compilação e não puxam o KV para o bundle do cliente.

import type { RoadmapPillar } from "@/lib/roadmap-store";
import type { PublicLang } from "@/lib/public-i18n";

/** Janela do «trabalho concluído»: os últimos 3 meses (≈ 90 dias). */
export const NPS_WORK_WINDOW_DAYS = 90;

export type NpsKpiDelta = {
  text: string;
  dir: "up" | "down" | "flat";
  good: boolean;
};

export type NpsReportKpi = {
  label: string;
  value: string;
  /** null num relatório parcial (um mês incompleto não se compara). */
  delta: NpsKpiDelta | null;
};

export type NpsReportDigest = {
  /** "2026-08". */
  period: string;
  /** "Agosto de 2026" / "August 2026" (com «parcial» quando o for). */
  periodLabel: string;
  partial: boolean;
  generatedAt: number;
  finalizedAt: number | null;
  consultantName: string;
  /** Resumo executivo do relatório (até 5 frases). */
  highlights: string[];
  /** Os números do topo do relatório, já formatados na língua do cliente. */
  kpis: NpsReportKpi[];
  /** Caminho público (só leitura) do relatório completo. */
  href: string;
};

export type NpsDoneAction = {
  id: string;
  title: string;
  pillar: RoadmapPillar;
  /** Epoch ms — quando a tarefa passou a «Implemented». */
  doneAt: number;
  /** Semana do roadmap em que a tarefa estava planeada. */
  week: number;
};

export type NpsWorkMonth = {
  /** "2026-09". */
  key: string;
  /** "Setembro 2026" / "September 2026". */
  label: string;
  items: NpsDoneAction[];
};

export type NpsWorkDigest = {
  /** Início e fim da janela (epoch ms). */
  since: number;
  until: number;
  total: number;
  byPillar: { pillar: RoadmapPillar; count: number }[];
  /** Mais recente primeiro. */
  months: NpsWorkMonth[];
  /** Caminho público do roadmap completo, quando existe um roadmap ativo. */
  roadmapHref: string | null;
};

export type NpsSurveyContext = {
  /** null = sem relatório finalizado para este cliente. */
  report: NpsReportDigest | null;
  /** null = sem roadmap; `total: 0` = roadmap sem ações concluídas na janela. */
  work: NpsWorkDigest | null;
};

export const NPS_PILLAR_LABEL: Record<RoadmapPillar, Record<PublicLang, string>> = {
  technical: { pt: "Técnico", en: "Technical" },
  "on-page": { pt: "On-Page", en: "On-Page" },
  "off-page": { pt: "Off-Page", en: "Off-Page" },
  local: { pt: "Local", en: "Local" },
  content: { pt: "Conteúdo", en: "Content" },
  research: { pt: "Pesquisa", en: "Research" },
};

/** Uma cor por pilar — a mesma no cartão, na lista e nas pastilhas. */
export const NPS_PILLAR_TONE: Record<RoadmapPillar, string> = {
  technical: "#2563eb",
  "on-page": "#7c3aed",
  "off-page": "#db2777",
  local: "#059669",
  content: "#d97706",
  research: "#0891b2",
};

const MONTHS: Record<PublicLang, string[]> = {
  pt: [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
};

/** "2026-09" → "Setembro 2026" / "September 2026". */
export function monthLabel(key: string, lang: PublicLang): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[lang][(m ?? 1) - 1] ?? key;
  return `${name} ${y}`;
}

/** "2026-08" → "Agosto de 2026" / "August 2026". */
export function periodLabel(key: string, lang: PublicLang): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[lang][(m ?? 1) - 1] ?? key;
  return lang === "pt" ? `${name} de ${y}` : `${name} ${y}`;
}

/** Chave "YYYY-MM" de um instante, no fuso de Lisboa — o mês em que a
 *  equipa (e o cliente) viveram a conclusão, não o mês UTC do servidor. */
export function lisbonMonthKey(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}
