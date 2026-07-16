import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Download,
  MessageSquareQuote,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { NpsManagerActions } from "@/components/nps-manager-actions";
import { NpsDeleteLatestButton } from "@/components/nps-delete-latest-button";
import { getClientBySlug } from "@/lib/notion";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import { getNpsRecord, type NpsSubmission } from "@/lib/nps-store";
import { getCurrentRoadmap } from "@/lib/roadmap-store";
import { DEFAULT_STARTING_DATES } from "@/lib/admin-clients-store";
import {
  NPS_SECTIONS,
  npsScoreColor,
  isScale10,
  isSingle,
  isMulti,
  isOpen,
} from "@/lib/nps-questions";
import { pickLang } from "@/lib/public-i18n";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { formatDate, formatDateTime, daysUntilISO, toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  return {
    title: client
      ? `NPS & Satisfação — ${client.title} · Wonder Ads`
      : "NPS · Wonder Ads",
  };
}

const scoreColor = npsScoreColor;

/** Whole calendar months elapsed since an ISO date (local). 0 within the
 *  first month. Used to derive "Nth month of the engagement". */
function monthsSinceISO(iso: string, now: Date = new Date()): number {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  let m =
    (now.getFullYear() - d.getFullYear()) * 12 +
    (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m -= 1;
  return Math.max(0, m);
}

const CATEGORY_STYLE: Record<
  string,
  { label: string; bg: string; text: string; ring: string }
> = {
  promoter: {
    label: "Promoter",
    bg: "rgba(52,211,153,0.12)",
    text: "#6ee7b7",
    ring: "rgba(52,211,153,0.35)",
  },
  passive: {
    label: "Passive",
    bg: "rgba(251,191,36,0.12)",
    text: "#fcd34d",
    ring: "rgba(251,191,36,0.35)",
  },
  detractor: {
    label: "Detractor",
    bg: "rgba(251,113,133,0.12)",
    text: "#fda4af",
    ring: "rgba(251,113,133,0.35)",
  },
};

export default async function NpsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const employee = await getCurrentEmployee();
  const readOnly = !employee || !editableDepts(employee).includes("seo");
  const isSuperAdmin = Boolean(employee?.isAdmin);

  const record = await getNpsRecord(slug);

  // Onboarding date + which month of the engagement the client is in —
  // the same facts surfaced on the roadmap page.
  const roadmap = await getCurrentRoadmap(slug);
  const onboardedIso =
    roadmap?.onboardingDate ??
    DEFAULT_STARTING_DATES[slug] ??
    roadmap?.startDate ??
    null;
  const engagementMonth = onboardedIso
    ? monthsSinceISO(onboardedIso) + 1
    : null;

  const logo = getClientLogo(slug);
  const gradient = paletteToGradient(getClientPalette(slug));
  const lang = pickLang(slug);
  const latest = record.submissions[0] ?? null;

  const nextDueIso = record.meta.nextDueAt
    ? toISODate(new Date(record.meta.nextDueAt))
    : null;
  const daysUntilDue = nextDueIso ? daysUntilISO(nextDueIso) : null;
  const overdue = daysUntilDue !== null && daysUntilDue < 0;

  return (
    <PageShell wide backHref={`/seo/${slug}`} backLabel={client.title}>
      {/* Header */}
      <section className="animate-fade-up mt-4 flex flex-wrap items-start justify-between gap-5 sm:mt-8">
        <div className="flex items-center gap-5">
          <div className="shrink-0">
            <LogoChip
              logo={logo}
              emoji={client.icon}
              alt={`${client.title} logo`}
              gradient={gradient}
              size="lg"
              bgMode={getLogoBgMode(slug)}
              sizing={getLogoSizing(slug)}
            />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
              <Sparkles className="h-2.5 w-2.5" />
              NPS &amp; Satisfação · SEO
            </span>
            <h1 className="mt-2 text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">
              <span className="brand-gradient-text">{client.title}</span>
            </h1>
            <p className="mt-1.5 text-sm text-white/45">
              Avaliação de satisfação do cliente — resultado mais recente,
              histórico e próximo envio.
            </p>
            {onboardedIso && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70"
                  title="Data em que o cliente entrou (onboarded) — a mesma que aparece no roadmap"
                >
                  <CalendarDays className="h-3 w-3 text-white/45" />
                  Cliente desde
                  <span className="font-semibold text-white/90">
                    {formatDate(onboardedIso)}
                  </span>
                </span>
                {engagementMonth && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#783DF5]/30 bg-[#783DF5]/10 px-2.5 py-1 text-[11px] text-white/80"
                    title="Mês de acompanhamento em que o cliente se encontra, contado desde o onboarding"
                  >
                    <CalendarClock className="h-3 w-3 text-[#a78bfa]" />
                    <span className="font-semibold text-white/95">
                      {engagementMonth}º mês
                    </span>
                    de acompanhamento
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Actions + cadence */}
      <section className="animate-fade-up mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              Próximo envio
            </p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-white/90">
              {nextDueIso ? formatDate(nextDueIso) : "Por agendar"}
              {overdue && (
                <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                  Em atraso {Math.abs(daysUntilDue!)}d
                </span>
              )}
              {!overdue && daysUntilDue !== null && (
                <span className="text-[11px] font-normal text-white/40">
                  em {daysUntilDue} dias
                </span>
              )}
            </p>
            {record.meta.lastSentAt && (
              <p className="mt-1 text-[11px] text-white/40">
                Último envio: {formatDateTime(record.meta.lastSentAt)}
                {record.meta.sends[0]?.by
                  ? ` · ${record.meta.sends[0]?.by}`
                  : ""}
              </p>
            )}
          </div>
          <NpsManagerActions
            slug={slug}
            surveyPath={`/${slug}/survey`}
            clientName={client.title}
            cadenceDays={record.meta.cadenceDays}
            lang={lang}
            readOnly={readOnly}
          />
        </div>
      </section>

      {latest ? (
        <>
          {/* Latest hero */}
          <section className="animate-fade-up mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
            <LatestHero latest={latest} />
            <KeyMetrics latest={latest} />
          </section>

          {/* Per-question answers — exactly what the client marked */}
          <section className="animate-fade-up mt-6">
            <AnswersDetail
              latest={latest}
              lang={lang}
              slug={slug}
              isSuperAdmin={isSuperAdmin}
            />
          </section>

          {/* Trend + history */}
          <section className="animate-fade-up mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
            <HistoryTable submissions={record.submissions} />
            <TrendPanel submissions={record.submissions} />
          </section>
        </>
      ) : (
        <EmptyState />
      )}
    </PageShell>
  );
}

function LatestHero({ latest }: { latest: NpsSubmission }) {
  const s = latest.scores;
  const cat = CATEGORY_STYLE[s.category];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
        Resultado mais recente
      </p>
      <div className="mt-4 flex items-end gap-3">
        <span
          className="text-6xl font-semibold leading-none"
          style={{ color: scoreColor(s.overall) }}
        >
          {s.overall.toFixed(1)}
        </span>
        <span className="mb-1 text-lg text-white/40">/ 10</span>
      </div>
      <p className="mt-1 text-xs text-white/45">Índice de satisfação global</p>

      <div className="mt-5 flex items-center gap-3 border-t border-white/8 pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            Continuidade
          </p>
          <p className="text-2xl font-semibold text-white/90">
            {s.nps}
            <span className="text-sm font-normal text-white/40"> / 10</span>
          </p>
        </div>
        <span
          className="ml-auto rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            background: cat.bg,
            color: cat.text,
            boxShadow: `inset 0 0 0 1px ${cat.ring}`,
          }}
        >
          {cat.label}
        </span>
      </div>

      <div className="mt-4 space-y-1 text-[11px] text-white/45">
        <p>Enviado em {formatDateTime(latest.submittedAt)}</p>
        {latest.identification && <p>Por: {latest.identification}</p>}
        {latest.consultant && <p>Consultor: {latest.consultant}</p>}
      </div>
    </div>
  );
}

/** The four scored dimensions, each out of 10. Replaces the old per-section
 *  breakdown (the survey now has only a handful of scored questions). */
function KeyMetrics({ latest }: { latest: NpsSubmission }) {
  const s = latest.scores;
  const rows: { label: string; value: number | null }[] = [
    { label: "Satisfação geral", value: s.satisfaction },
    { label: "Consultor de SEO", value: s.consultant },
    { label: "Continuidade", value: s.nps },
    { label: "Progresso nos objetivos", value: s.progress },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
        Métricas-chave (0–10)
      </p>
      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-white/70">{r.label}</span>
              <span
                className="font-mono text-sm font-medium"
                style={{
                  color:
                    r.value === null ? "rgba(255,255,255,0.35)" : scoreColor(r.value),
                }}
              >
                {r.value === null ? "—" : r.value.toFixed(1)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${((r.value ?? 0) / 10) * 100}%`,
                  background:
                    r.value === null ? "transparent" : scoreColor(r.value),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The core review surface: every question the client saw, with the exact
 *  answer they gave, in the language they answered in. */
function AnswersDetail({
  latest,
  lang,
  slug,
  isSuperAdmin,
}: {
  latest: NpsSubmission;
  lang: ReturnType<typeof pickLang>;
  slug: string;
  isSuperAdmin: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/45">
          <ClipboardList className="h-3 w-3" />
          Respostas do cliente — última avaliação
        </p>
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-white/40">
            Respondido em {formatDateTime(latest.submittedAt)}
            {latest.identification ? ` · ${latest.identification}` : ""}
          </p>
          <Link
            href={`/seo/${slug}/nps/print`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir folha imprimível com todas as perguntas e respostas para guardar em PDF"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-white/70 transition hover:border-[#783DF5]/50 hover:bg-[#783DF5]/15 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Link>
          <NpsDeleteLatestButton slug={slug} isSuperAdmin={isSuperAdmin} />
        </div>
      </div>

      <div className="mt-5 space-y-6">
        {NPS_SECTIONS.filter((s) => s.questions.length > 0).map((section) => (
          <div key={section.key}>
            <div className="mb-3 flex items-baseline gap-2 border-b border-white/8 pb-2">
              <span className="font-mono text-[10px] tracking-widest text-[#a78bfa]">
                {section.tag}
              </span>
              <span className="text-sm font-semibold text-white/80">
                {section.title[lang]}
              </span>
            </div>

            <div className="space-y-4">
              {section.questions.map((q) => {
                if (isScale10(q)) {
                  const value = latest.answers[q.name];
                  const has = typeof value === "number";
                  return (
                    <div
                      key={q.name}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                    >
                      <div>
                        <p className="text-sm leading-snug text-white/75">
                          {q.q[lang]}
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/35">
                          0 = {q.capLow[lang]} · 10 = {q.capHigh[lang]}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${((value ?? 0) / 10) * 100}%`,
                              background: has ? scoreColor(value) : "transparent",
                            }}
                          />
                        </div>
                        <span
                          className="w-12 text-right font-mono text-sm font-semibold"
                          style={{ color: has ? scoreColor(value) : undefined }}
                        >
                          {has ? `${value}/10` : "—"}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (isSingle(q)) {
                  const picked = latest.choices?.[q.name]?.[0];
                  return (
                    <div key={q.name}>
                      <p className="text-sm leading-snug text-white/75">
                        {q.q[lang]}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {q.options.map((o) => {
                          const on = picked === o.value;
                          return (
                            <span
                              key={o.value}
                              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
                              style={
                                on
                                  ? {
                                      borderColor: "rgba(120,61,245,0.5)",
                                      background: "rgba(120,61,245,0.16)",
                                      color: "#c4b5fd",
                                    }
                                  : {
                                      borderColor: "rgba(255,255,255,0.08)",
                                      color: "rgba(255,255,255,0.30)",
                                    }
                              }
                            >
                              {on ? "● " : ""}
                              {o.label[lang]}
                            </span>
                          );
                        })}
                        {!picked && (
                          <span className="text-[11px] italic text-white/30">
                            Sem resposta
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                if (isMulti(q)) {
                  const chosen = latest.choices?.[q.name] ?? [];
                  return (
                    <div key={q.name}>
                      <p className="text-sm leading-snug text-white/75">
                        {q.q[lang]}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {q.options.map((o) => {
                          const on = chosen.includes(o.value);
                          return (
                            <span
                              key={o.value}
                              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
                              style={
                                on
                                  ? {
                                      borderColor: "rgba(52,211,153,0.4)",
                                      background: "rgba(52,211,153,0.12)",
                                      color: "#6ee7b7",
                                    }
                                  : {
                                      borderColor: "rgba(255,255,255,0.08)",
                                      color: "rgba(255,255,255,0.30)",
                                    }
                              }
                            >
                              {on ? "✓ " : ""}
                              {o.label[lang]}
                            </span>
                          );
                        })}
                        {chosen.length === 0 && (
                          <span className="text-[11px] italic text-white/30">
                            Sem seleção
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                // open
                const text = latest.texts?.[q.name];
                return (
                  <div key={q.name}>
                    <p className="text-sm leading-snug text-white/75">
                      {q.q[lang]}
                    </p>
                    {text ? (
                      <p className="mt-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed text-white/80">
                        “{text}”
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] italic text-white/30">
                        Sem resposta
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendPanel({ submissions }: { submissions: NpsSubmission[] }) {
  // Chronological (oldest → newest) for the sparkline.
  const points = [...submissions].reverse();
  const W = 320;
  const H = 120;
  const PAD = 10;
  const n = points.length;
  const coords = points.map((p, i) => {
    const x = n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = PAD + (1 - p.scores.overall / 10) * (H - PAD * 2);
    return { x, y, v: p.scores.overall };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const delta =
    n >= 2
      ? points[n - 1].scores.overall - points[n - 2].scores.overall
      : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/45">
        <TrendingUp className="h-3 w-3" />
        Evolução ({n} {n === 1 ? "resposta" : "respostas"})
      </p>
      {n >= 2 ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-4 w-full"
            preserveAspectRatio="none"
          >
            {[0, 5, 10].map((g) => {
              const y = PAD + (1 - g / 10) * (H - PAD * 2);
              return (
                <line
                  key={g}
                  x1={PAD}
                  x2={W - PAD}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
              );
            })}
            <path d={path} fill="none" stroke="#783DF5" strokeWidth={2.5} />
            {coords.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r={3} fill="#C535C9" />
            ))}
          </svg>
          {delta !== null && (
            <p className="mt-2 text-[11px] text-white/45">
              Face à anterior:{" "}
              <span
                style={{
                  color:
                    delta > 0 ? "#6ee7b7" : delta < 0 ? "#fda4af" : "#cbd5e1",
                }}
              >
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta).toFixed(1)}
              </span>
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-white/40">
          Ainda só há uma resposta — a evolução aparece a partir da segunda.
        </p>
      )}
    </div>
  );
}

function HistoryTable({ submissions }: { submissions: NpsSubmission[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
        Histórico
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/8 text-[10px] uppercase tracking-wide text-white/40">
              <th className="py-2 pr-4 font-medium">Data</th>
              <th className="py-2 pr-4 font-medium">Global /10</th>
              <th className="py-2 pr-4 font-medium">Contin. /10</th>
              <th className="py-2 pr-4 font-medium">Respondente</th>
              <th className="py-2 font-medium">Justificação</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => {
              const justify = s.texts?.p4_justifica ?? null;
              return (
                <tr
                  key={s.id}
                  className="border-b border-white/5 align-top text-white/75"
                >
                  <td className="whitespace-nowrap py-2.5 pr-4 text-white/60">
                    {formatDate(s.submittedAt)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className="font-mono font-semibold"
                      style={{ color: scoreColor(s.scores.overall) }}
                    >
                      {s.scores.overall.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-white/70">
                    {s.scores.nps}
                  </td>
                  <td className="py-2.5 pr-4 text-white/60">
                    {s.identification ?? "—"}
                  </td>
                  <td className="max-w-[280px] py-2.5 text-white/60">
                    {justify ? (
                      <span className="line-clamp-2">{justify}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="animate-fade-up mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur-md">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <MessageSquareQuote className="h-5 w-5 text-white/50" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white/85">
        Ainda sem respostas
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-white/50">
        Envie o formulário de avaliação ao cliente com o botão{" "}
        <span className="text-white/75">Send to client</span> acima. Assim que
        o cliente responder, o resultado (0–10), a continuidade e o histórico
        aparecem aqui.
      </p>
    </section>
  );
}
