// Branded, light-theme presentation of an SEO roadmap for the client
// approval preview (rendered inside PublicReportView's bodySlot). A clean
// month → week → task layout that reads like a polished plan, not a raw
// markdown list. No internal SEO diagnosis — just the roadmap.

import {
  weekStartDate,
  type Roadmap,
  type RoadmapPillar,
  type RoadmapStatus,
} from "@/lib/roadmap-store";
import { formatDate } from "@/lib/dates";

type Lang = "pt" | "en";

const STATUS_META: Record<
  RoadmapStatus,
  { label: Record<Lang, string>; dot: string; text: string; bg: string }
> = {
  not_started: {
    label: { pt: "Por iniciar", en: "Not started" },
    dot: "#cbd5e1",
    text: "#64748b",
    bg: "#f1f5f9",
  },
  in_progress: {
    label: { pt: "Em curso", en: "In progress" },
    dot: "#f59e0b",
    text: "#b45309",
    bg: "#fef3c7",
  },
  pending_review: {
    label: { pt: "Em aprovação", en: "In review" },
    dot: "#8b5cf6",
    text: "#6d28d9",
    bg: "#ede9fe",
  },
  implemented: {
    label: { pt: "Concluído", en: "Done" },
    dot: "#10b981",
    text: "#047857",
    bg: "#d1fae5",
  },
};

const PILLAR_LABEL: Record<RoadmapPillar, Record<Lang, string>> = {
  technical: { pt: "Técnico", en: "Technical" },
  "on-page": { pt: "On-Page", en: "On-Page" },
  "off-page": { pt: "Off-Page", en: "Off-Page" },
  local: { pt: "Local", en: "Local" },
  content: { pt: "Conteúdo", en: "Content" },
  research: { pt: "Pesquisa", en: "Research" },
};

const MONTHS = [
  { weeks: [1, 2, 3, 4] },
  { weeks: [5, 6, 7, 8] },
  { weeks: [9, 10, 11, 12] },
];

const COPY: Record<
  Lang,
  { tasks: string; month: string; week: string; thisWeek: string; empty: string }
> = {
  pt: {
    tasks: "tarefas",
    month: "Mês",
    week: "Semana",
    thisWeek: "Esta semana",
    empty: "Sem tarefas nesta semana.",
  },
  en: {
    tasks: "tasks",
    month: "Month",
    week: "Week",
    thisWeek: "This week",
    empty: "No tasks this week.",
  },
};

export function RoadmapReportBody({
  roadmap,
  weeks,
  currentWeek,
  lang = "pt",
}: {
  roadmap: Roadmap;
  /** Which week numbers (1–12) to render. */
  weeks: number[];
  currentWeek: number;
  lang?: Lang;
}) {
  const c = COPY[lang];
  const weekSet = new Set(weeks);

  // Bucket tasks by week, ordered.
  const byWeek = new Map<number, Roadmap["tasks"]>();
  for (const t of roadmap.tasks) {
    if (!weekSet.has(t.week)) continue;
    if (!byWeek.has(t.week)) byWeek.set(t.week, []);
    byWeek.get(t.week)!.push(t);
  }
  for (const list of byWeek.values()) list.sort((a, b) => a.order - b.order);

  const shownTaskCount = weeks.reduce(
    (s, w) => s + (byWeek.get(w)?.length ?? 0),
    0,
  );

  const monthsToShow = MONTHS.map((m, i) => ({ ...m, index: i })).filter((m) =>
    m.weeks.some((w) => weekSet.has(w)),
  );

  return (
    <div style={{ marginTop: "0.5rem" }}>
      {/* Meta strip */}
      <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 1.5rem" }}>
        {shownTaskCount} {c.tasks} · {formatDate(roadmap.startDate)} →{" "}
        {formatDate(weekStartDate(roadmap, 12))}
      </p>

      {monthsToShow.map((m) => {
        const monthWeeks = m.weeks.filter((w) => weekSet.has(w));
        return (
          <section key={m.index} style={{ marginBottom: "2rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                margin: "0 0 1rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#783DF5",
                }}
              >
                {c.month} {m.index + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  height: 2,
                  borderRadius: 2,
                  background:
                    "linear-gradient(90deg, #783DF5 0%, #C535C9 100%)",
                  opacity: 0.25,
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {monthWeeks.map((w) => {
                const tasks = byWeek.get(w) ?? [];
                const isNow = w === currentWeek;
                return (
                  <div
                    key={w}
                    style={{
                      border: isNow
                        ? "1.5px solid rgba(120,61,245,0.55)"
                        : "1px solid rgba(0,0,0,0.09)",
                      borderRadius: 12,
                      background: isNow ? "#faf8ff" : "#fff",
                      overflow: "hidden",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* Week header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        padding: "0.7rem 0.9rem",
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                        background: isNow
                          ? "rgba(120,61,245,0.06)"
                          : "rgba(0,0,0,0.015)",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          background:
                            "linear-gradient(135deg, #343ED7 0%, #783DF5 53%, #C535C9 100%)",
                          color: "#fff",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {w}
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.92rem",
                          color: "#1e293b",
                        }}
                      >
                        {c.week} {w}
                      </span>
                      {isNow && (
                        <span
                          style={{
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#783DF5",
                            background: "rgba(120,61,245,0.12)",
                            border: "1px solid rgba(120,61,245,0.3)",
                            borderRadius: 999,
                            padding: "0.12rem 0.5rem",
                          }}
                        >
                          {c.thisWeek}
                        </span>
                      )}
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "0.78rem",
                          color: "#94a3b8",
                        }}
                      >
                        {formatDate(weekStartDate(roadmap, w))}
                      </span>
                    </div>

                    {/* Tasks */}
                    {tasks.length === 0 ? (
                      <p
                        style={{
                          margin: 0,
                          padding: "0.9rem",
                          fontSize: "0.82rem",
                          color: "#94a3b8",
                          textAlign: "center",
                        }}
                      >
                        {c.empty}
                      </p>
                    ) : (
                      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {tasks.map((t, idx) => {
                          const meta = STATUS_META[t.status];
                          return (
                            <li
                              key={t.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.6rem",
                                padding: "0.65rem 0.9rem",
                                borderTop:
                                  idx === 0
                                    ? "none"
                                    : "1px solid rgba(0,0,0,0.05)",
                              }}
                            >
                              <span
                                style={{
                                  marginTop: 6,
                                  width: 9,
                                  height: 9,
                                  borderRadius: 999,
                                  background: meta.dot,
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "0.88rem",
                                    lineHeight: 1.4,
                                    color: "#1e293b",
                                  }}
                                >
                                  {t.title}
                                </span>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    gap: "0.4rem",
                                    marginTop: "0.3rem",
                                    alignItems: "center",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "0.62rem",
                                      fontWeight: 600,
                                      letterSpacing: "0.04em",
                                      textTransform: "uppercase",
                                      color: "#6b5fa8",
                                      background: "#f1effb",
                                      borderRadius: 5,
                                      padding: "0.1rem 0.4rem",
                                    }}
                                  >
                                    {PILLAR_LABEL[t.pillar]?.[lang] ?? t.pillar}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.66rem",
                                      fontWeight: 600,
                                      color: meta.text,
                                      background: meta.bg,
                                      borderRadius: 5,
                                      padding: "0.1rem 0.4rem",
                                    }}
                                  >
                                    {meta.label[lang]}
                                  </span>
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
