import { notFound } from "next/navigation";
import { MessageSquareQuote, Sparkles, TrendingUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { NpsManagerActions } from "@/components/nps-manager-actions";
import { getClientBySlug } from "@/lib/notion";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import { getNpsRecord, type NpsSubmission } from "@/lib/nps-store";
import {
  NPS_SECTIONS,
  sectionTitle,
  npsScoreColor,
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

  const record = await getNpsRecord(slug);
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
            <SectionBreakdown latest={latest} lang={lang} />
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
        <span className="mb-1 text-lg text-white/40">/ 5</span>
      </div>
      <p className="mt-1 text-xs text-white/45">Índice de satisfação global</p>

      <div className="mt-5 flex items-center gap-3 border-t border-white/8 pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            Recomendação
          </p>
          <p className="text-2xl font-semibold text-white/90">
            {s.nps}
            <span className="text-sm font-normal text-white/40"> / 5</span>
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

      {latest.comment && (
        <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.03] p-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
            <MessageSquareQuote className="h-3 w-3" />
            Comentário
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/75">
            “{latest.comment}”
          </p>
        </div>
      )}
    </div>
  );
}

function SectionBreakdown({
  latest,
  lang,
}: {
  latest: NpsSubmission;
  lang: ReturnType<typeof pickLang>;
}) {
  const scores = latest.scores.sectionScores;
  const rows = NPS_SECTIONS.map((sec) => ({
    key: sec.key,
    label: sectionTitle(sec.key, lang),
    value: scores[sec.key],
  })).filter((r) => typeof r.value === "number");

  const weakest = rows.reduce(
    (min, r) => (r.value! < (min?.value ?? Infinity) ? r : min),
    null as (typeof rows)[number] | null,
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
        Por secção
      </p>
      <div className="mt-5 space-y-4">
        {rows.map((r) => {
          const isWeak = weakest?.key === r.key && r.value! < 3.5;
          return (
            <div key={r.key}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-white/70">
                  {r.label}
                  {isWeak && (
                    <span className="ml-2 rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-200">
                      Ponto fraco
                    </span>
                  )}
                </span>
                <span
                  className="font-mono text-sm font-medium"
                  style={{ color: scoreColor(r.value!) }}
                >
                  {r.value!.toFixed(1)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${(r.value! / 5) * 100}%`,
                    background: scoreColor(r.value!),
                  }}
                />
              </div>
            </div>
          );
        })}
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
    const y = PAD + (1 - p.scores.overall / 5) * (H - PAD * 2);
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
            {[0, 2.5, 5].map((g) => {
              const y = PAD + (1 - g / 5) * (H - PAD * 2);
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
              <th className="py-2 pr-4 font-medium">Global /5</th>
              <th className="py-2 pr-4 font-medium">Recom. /5</th>
              <th className="py-2 pr-4 font-medium">Respondente</th>
              <th className="py-2 font-medium">Comentário</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
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
                  {s.comment ? (
                    <span className="line-clamp-2">{s.comment}</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
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
        o cliente responder, o resultado (0–10), o NPS e o histórico aparecem
        aqui.
      </p>
    </section>
  );
}
