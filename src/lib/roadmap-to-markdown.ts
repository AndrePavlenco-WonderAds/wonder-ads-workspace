// Render a client-facing, READ-ONLY markdown version of a 12-week SEO
// roadmap. Fed into the existing PublicReportView so it inherits the
// branded light-theme report chrome (Download PDF, comments, footer) —
// the client reads the plan like a document and can't edit tasks.

import {
  ROADMAP_STATUSES,
  weekStartDate,
  type Roadmap,
  type RoadmapPillar,
  type RoadmapStatus,
} from "./roadmap-store";
import { formatDate } from "./dates";

type Lang = "pt" | "en";

const STATUS_LABEL: Record<Lang, Record<RoadmapStatus, string>> = {
  pt: {
    not_started: "Por iniciar",
    in_progress: "Em curso",
    pending_review: "Em aprovação",
    implemented: "Concluído",
  },
  en: {
    not_started: "Not started",
    in_progress: "In progress",
    pending_review: "In review",
    implemented: "Done",
  },
};

const STATUS_EMOJI: Record<RoadmapStatus, string> = {
  not_started: "⚪",
  in_progress: "🟡",
  pending_review: "🔵",
  implemented: "✅",
};

const PILLAR_LABEL: Record<Lang, Record<RoadmapPillar, string>> = {
  pt: {
    technical: "Técnico",
    "on-page": "On-Page",
    "off-page": "Off-Page",
    local: "Local",
    content: "Conteúdo",
    research: "Pesquisa",
  },
  en: {
    technical: "Technical",
    "on-page": "On-Page",
    "off-page": "Off-Page",
    local: "Local",
    content: "Content",
    research: "Research",
  },
};

const COPY: Record<
  Lang,
  {
    started: string;
    generated: string;
    tasks: string;
    month: string;
    week: string;
    legend: string;
    diagnosis: string;
    empty: string;
  }
> = {
  pt: {
    started: "Início",
    generated: "Gerado",
    tasks: "tarefas",
    month: "Mês",
    week: "Semana",
    legend: "Legenda",
    diagnosis: "Diagnóstico SEO",
    empty: "Ainda sem tarefas neste roadmap.",
  },
  en: {
    started: "Starts",
    generated: "Generated",
    tasks: "tasks",
    month: "Month",
    week: "Week",
    legend: "Legend",
    diagnosis: "SEO diagnosis",
    empty: "No tasks on this roadmap yet.",
  },
};

const MONTHS = [
  { weeks: [1, 2, 3, 4] },
  { weeks: [5, 6, 7, 8] },
  { weeks: [9, 10, 11, 12] },
];

/** Build the read-only markdown report for a roadmap. */
export function roadmapToMarkdown(roadmap: Roadmap, lang: Lang = "pt"): string {
  const c = COPY[lang];
  const lines: string[] = [];

  // Meta line.
  const meta = [
    `**${c.started}:** ${formatDate(roadmap.startDate)}`,
    `**${c.generated}:** ${formatDate(roadmap.generatedAt)}`,
    `**${roadmap.tasks.length} ${c.tasks}**`,
  ].join(" · ");
  lines.push(meta, "");

  // Status legend so the client knows what the markers mean.
  const legend = ROADMAP_STATUSES.map(
    (s) => `${STATUS_EMOJI[s]} ${STATUS_LABEL[lang][s]}`,
  ).join(" · ");
  lines.push(`*${c.legend}: ${legend}*`, "");

  // Optional SEO diagnosis the agent wrote before sequencing tasks.
  if (roadmap.auditSummary && roadmap.auditSummary.trim()) {
    lines.push(`## ${c.diagnosis}`, "", roadmap.auditSummary.trim(), "");
  }

  if (roadmap.tasks.length === 0) {
    lines.push(c.empty);
    return lines.join("\n");
  }

  // Group tasks by week (1–12), sorted by their column order.
  const byWeek = new Map<number, typeof roadmap.tasks>();
  for (const t of roadmap.tasks) {
    const w = t.week >= 1 && t.week <= 12 ? t.week : 12;
    if (!byWeek.has(w)) byWeek.set(w, []);
    byWeek.get(w)!.push(t);
  }
  for (const list of byWeek.values()) list.sort((a, b) => a.order - b.order);

  MONTHS.forEach((m, mi) => {
    const monthHasTasks = m.weeks.some((w) => (byWeek.get(w)?.length ?? 0) > 0);
    if (!monthHasTasks) return;
    lines.push(`## ${c.month} ${mi + 1}`, "");
    for (const w of m.weeks) {
      const tasks = byWeek.get(w);
      if (!tasks || tasks.length === 0) continue;
      lines.push(`### ${c.week} ${w} — ${formatDate(weekStartDate(roadmap, w))}`, "");
      for (const t of tasks) {
        const tag = `\`${PILLAR_LABEL[lang][t.pillar] ?? t.pillar}\``;
        lines.push(
          `- ${STATUS_EMOJI[t.status]} **${t.title.trim()}** — ${STATUS_LABEL[lang][t.status]} · ${tag}`,
        );
        if (t.description && t.description.trim()) {
          lines.push(`  - ${t.description.trim()}`);
        }
      }
      lines.push("");
    }
  });

  return lines.join("\n").trim();
}
