// A página de um consultor SEO (/seo/roadmaps/<consultor>), redesenhada na
// v78.42. Lê-se de cima para baixo, do mais urgente para o mais geral:
//
//   1. Os números da carteira (semana, atrasos, aprovações, NPS, folga).
//   2. «Fazer primeiro» — as tarefas desta semana de TODOS os projetos, já
//      ordenadas — e «Precisa de atenção» — NPS por enviar, folga passada,
//      roadmaps em atraso ou por gerar.
//   3. A carteira — uma linha por projeto com o roadmap, a semana, o NPS do
//      mês anterior e do atual e a folga de custos de hoje.
//   4. Esta semana, projeto a projeto — o que havia antes, com as tarefas.
//
// Server component: só links, sem estado. Os cartões repetidos não usam
// desfoque de fundo (o SEO DPT ficou pesado por causa disso, v78.34).

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock,
  FolderOpen,
  Gauge,
  HeartPulse,
  ListTodo,
  Map as MapIcon,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LogoChip } from "@/components/logo-chip";
import type { ConsultantWeekClient, ConsultantWeekView, WeekTask } from "@/lib/roadmap-admin-helpers";
import type { RoadmapPillar, RoadmapStatus } from "@/lib/roadmap-store";
import type { PortfolioRow } from "@/lib/consultant-portfolio";
import { TIER_LABEL } from "@/lib/client-tiers";
import { npsScoreColor } from "@/lib/nps-questions";
import { eurCents } from "@/lib/seo-folga";

const HEALTH: Record<ConsultantWeekClient["health"], { label: string; chip: string; rank: number }> = {
  critical: { label: "Crítico", chip: "border-rose-400/40 bg-rose-500/15 text-rose-200", rank: 0 },
  behind: { label: "Atrasado", chip: "border-amber-400/30 bg-amber-500/10 text-amber-200", rank: 1 },
  "no-roadmap": { label: "Sem roadmap", chip: "border-violet-400/30 bg-violet-500/10 text-violet-200", rank: 2 },
  "not-started": { label: "Não iniciado", chip: "border-white/15 bg-white/[0.04] text-white/65", rank: 3 },
  "on-track": { label: "Em dia", chip: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", rank: 4 },
};

const STATUS: Record<RoadmapStatus, { label: string; dot: string; text: string; rank: number }> = {
  in_progress: { label: "Em curso", dot: "bg-amber-400", text: "text-amber-100", rank: 0 },
  not_started: { label: "Por fazer", dot: "bg-white/45", text: "text-white/70", rank: 1 },
  pending_review: { label: "Em aprovação", dot: "bg-violet-400", text: "text-violet-100", rank: 2 },
  implemented: { label: "Concluído", dot: "bg-emerald-400", text: "text-emerald-200/70", rank: 3 },
};

const PILLAR: Record<RoadmapPillar, string> = {
  technical: "Técnico",
  "on-page": "On-Page",
  "off-page": "Off-Page",
  local: "Local",
  content: "Conteúdo",
  research: "Pesquisa",
};

const FOLGA_TONE: Record<PortfolioRow["folga"]["state"], { text: string; bar: string }> = {
  ok: { text: "text-emerald-200", bar: "bg-emerald-300" },
  low: { text: "text-amber-200", bar: "bg-amber-300" },
  out: { text: "text-rose-200", bar: "bg-rose-300" },
  over: { text: "text-rose-200", bar: "bg-rose-400" },
  lite: { text: "text-white/45", bar: "bg-white/20" },
  unset: { text: "text-white/45", bar: "bg-white/20" },
};

const score = (n: number) => n.toFixed(1).replace(".", ",");
const remainingOf = (c: ConsultantWeekClient) => c.thisWeekTasks.filter((t) => t.status !== "implemented").length;

type Props = { view: ConsultantWeekView; portfolio: Record<string, PortfolioRow> };

export function ConsultantWeekView({ view, portfolio }: Props) {
  const rows = view.clients.map((c) => ({ c, p: portfolio[c.slug] }));

  // NPS do mês anterior: média e quantos responderam (a WonderAds não conta).
  const npsRows = rows.filter((r) => r.p && !r.p.nps.excluded);
  const prevScores = npsRows.map((r) => r.p.nps.previous.score).filter((s): s is number => s !== null);
  const prevAvg = prevScores.length ? prevScores.reduce((s, x) => s + x, 0) / prevScores.length : null;
  const prevShort = npsRows[0]?.p.nps.previous.short ?? "";
  const folgaFree = rows.reduce((s, r) => s + (r.p && r.p.folga.remaining > 0 && r.p.folga.pctFree !== null ? r.p.folga.remaining : 0), 0);
  const folgaOver = rows.filter((r) => r.p?.folga.state === "over").length;
  const t = view.totals;

  return (
    <div className="mt-8 space-y-10 pb-12">
      {/* 1 · Os números */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat icon={CalendarRange} label="Projetos" value={t.clients} sub={`${t.withRoadmap} com roadmap`} />
        <Stat
          icon={ListTodo}
          label="Esta semana"
          value={t.thisWeekRemaining}
          sub={`por fazer de ${t.thisWeekTasks}`}
          tone={t.thisWeekRemaining > 0 ? "brand" : "good"}
        />
        <Stat
          icon={AlertTriangle}
          label="Em atraso"
          value={t.overdue}
          sub="de semanas anteriores"
          tone={t.overdue >= 5 ? "bad" : t.overdue > 0 ? "warn" : "muted"}
        />
        <Stat
          icon={CheckCircle2}
          label="Em aprovação"
          value={t.pendingApproval}
          sub="à espera do cliente"
          tone={t.pendingApproval > 0 ? "violet" : "muted"}
        />
        <Stat
          icon={Gauge}
          label={`NPS de ${prevShort.toLowerCase()}`}
          value={prevAvg === null ? "—" : score(prevAvg)}
          sub={`${prevScores.length} de ${npsRows.length} responderam`}
          color={prevAvg === null ? undefined : npsScoreColor(prevAvg)}
        />
        <Stat
          icon={Wallet}
          label="Folga livre"
          value={eurCents(folgaFree)}
          sub={folgaOver > 0 ? `${folgaOver} ${folgaOver === 1 ? "projeto acima" : "projetos acima"} da folga` : "este mês, na carteira"}
          tone={folgaOver > 0 ? "bad" : "default"}
        />
      </div>

      {view.notionUnavailable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          O Notion está indisponível neste momento — alguns projetos podem não aparecer.
        </div>
      )}

      {view.clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center text-sm text-white/45">
          Ainda não há clientes atribuídos.
        </div>
      ) : (
        <>
          {/* 2 · O que fazer agora */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <FirstThings clients={view.clients} />
            <Attention rows={rows} />
          </div>

          {/* 3 · A carteira */}
          <Portfolio rows={rows} />

          {/* 4 · Projeto a projeto */}
          <section id="semana" className="scroll-mt-24">
            <SectionTitle title="Esta semana, projeto a projeto" hint="O roadmap de cada projeto na semana em curso." />
            <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {view.clients.map((c) => (
                <ClientWeekCard key={c.slug} client={c} p={portfolio[c.slug]} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionTitle({ title, hint, aside }: { title: string; hint?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[1.3rem] font-semibold tracking-[-0.01em] text-white">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-white/45">{hint}</p>}
      </div>
      {aside}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub: string;
  tone?: "default" | "brand" | "good" | "warn" | "bad" | "violet" | "muted";
  color?: string;
}) {
  const cls = {
    default: "text-white",
    brand: "brand-gradient-text",
    good: "text-emerald-200",
    warn: "text-amber-200",
    bad: "text-rose-200",
    violet: "text-violet-200",
    muted: "text-white/55",
  }[tone];
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[12px] text-white/50">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-1.5 text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums ${cls}`} style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-white/40">{sub}</div>
    </div>
  );
}

/** As tarefas desta semana de todos os projetos, por ordem: primeiro os
 *  projetos em pior estado, e dentro deles o que já está em curso. */
function FirstThings({ clients }: { clients: ConsultantWeekClient[] }) {
  const queue: Array<{ task: WeekTask; client: ConsultantWeekClient }> = [];
  for (const c of clients) {
    for (const task of c.thisWeekTasks) if (task.status !== "implemented") queue.push({ task, client: c });
  }
  queue.sort(
    (a, b) =>
      HEALTH[a.client.health].rank - HEALTH[b.client.health].rank ||
      STATUS[a.task.status].rank - STATUS[b.task.status].rank ||
      a.client.title.localeCompare(b.client.title, "pt"),
  );
  const shown = queue.slice(0, 7);

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <SectionTitle
        title="Fazer primeiro"
        hint="As tarefas desta semana de todos os projetos, por ordem."
        aside={queue.length > shown.length ? (
          <a href="#semana" className="text-[12.5px] text-white/50 hover:text-white">
            +{queue.length - shown.length} mais
          </a>
        ) : undefined}
      />
      {shown.length === 0 ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-5">
          <Sparkles className="h-5 w-5 text-emerald-300" />
          <p className="text-[14px] text-emerald-100/90">Tudo o que estava para esta semana está feito.</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {shown.map(({ task, client }, i) => (
            <li key={`${client.slug}-${task.id}`}>
              <Link
                href={`/seo/${client.slug}/roadmap`}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                    i === 0 ? "text-white" : "bg-white/[0.06] text-white/55"
                  }`}
                  style={i === 0 ? { background: "var(--brand-gradient)" } : undefined}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-white/90">{task.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-white/40">
                    <span className="text-white/60">{client.title}</span>
                    <span>{PILLAR[task.pillar] ?? task.pillar}</span>
                    <span className={`inline-flex items-center gap-1 ${STATUS[task.status].text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS[task.status].dot}`} />
                      {STATUS[task.status].label}
                    </span>
                  </span>
                </span>
                {client.health === "critical" || client.health === "behind" ? (
                  <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium sm:inline ${HEALTH[client.health].chip}`}>
                    {HEALTH[client.health].label}
                  </span>
                ) : null}
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

type Row = { c: ConsultantWeekClient; p: PortfolioRow | undefined };

/** O que está a pedir uma ação fora do roadmap da semana. */
function Attention({ rows }: { rows: Row[] }) {
  const items: Array<{ key: string; href: string; icon: LucideIcon; tone: string; text: React.ReactNode }> = [];
  for (const { c, p } of rows) {
    if (p && !p.nps.excluded && p.nps.current.state === "por-enviar") {
      items.push({
        key: `nps-${c.slug}`,
        href: `/seo/${c.slug}/nps`,
        icon: HeartPulse,
        tone: "text-rose-300",
        text: (
          <>
            Enviar o NPS de {p.nps.current.short.toLowerCase()} a <b className="font-medium text-white">{c.title}</b>
          </>
        ),
      });
    }
    if (p?.folga.state === "over" || p?.folga.state === "out") {
      items.push({
        key: `folga-${c.slug}`,
        href: `/seo/${c.slug}/folga`,
        icon: Wallet,
        tone: "text-rose-300",
        text: (
          <>
            <b className="font-medium text-white">{c.title}</b>{" "}
            {p.folga.state === "over" ? `passou a folga (${eurCents(p.folga.remaining)})` : "esgotou a folga do mês"}: os próximos extras são cobrados
          </>
        ),
      });
    }
    if (c.health === "critical" || (c.health === "behind" && c.overduePastWeeks > 0)) {
      items.push({
        key: `late-${c.slug}`,
        href: `/seo/${c.slug}/roadmap`,
        icon: AlertTriangle,
        tone: c.health === "critical" ? "text-rose-300" : "text-amber-300",
        text: (
          <>
            <b className="font-medium text-white">{c.title}</b> tem {c.overduePastWeeks}{" "}
            {c.overduePastWeeks === 1 ? "tarefa em atraso" : "tarefas em atraso"}
          </>
        ),
      });
    }
    if (!c.hasRoadmap) {
      items.push({
        key: `rm-${c.slug}`,
        href: `/seo/${c.slug}/roadmap`,
        icon: MapIcon,
        tone: "text-violet-300",
        text: (
          <>
            <b className="font-medium text-white">{c.title}</b> ainda não tem roadmap
          </>
        ),
      });
    }
  }

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <SectionTitle title="Precisa de atenção" hint="Fora das tarefas da semana." />
      {items.length === 0 ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          <p className="text-[14px] text-emerald-100/90">Nada pendente: NPS enviados, folgas em dia e roadmaps sem atrasos.</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-white/[0.06]">
          {items.slice(0, 9).map((it) => (
            <li key={it.key}>
              <Link href={it.href} className="group flex items-center gap-3 py-2.5 text-[13.5px] text-white/65 transition hover:text-white">
                <it.icon className={`h-4 w-4 shrink-0 ${it.tone}`} />
                <span className="min-w-0 flex-1 leading-snug">{it.text}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
              </Link>
            </li>
          ))}
          {items.length > 9 && <li className="pt-2.5 text-[12.5px] text-white/40">+{items.length - 9} mais na carteira, abaixo.</li>}
        </ul>
      )}
    </section>
  );
}

/** Uma linha por projeto: roadmap, semana, NPS e folga. */
function Portfolio({ rows }: { rows: Row[] }) {
  const sample = rows.find((r) => r.p)?.p;
  return (
    <section>
      <SectionTitle title="A carteira" hint="Projeto a projeto: o roadmap, a semana, o NPS e a folga de custos de hoje." />
      <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02]">
        <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_auto] gap-4 border-b border-white/[0.07] px-5 py-3 text-[12px] text-white/40 lg:grid">
          <span>Projeto</span>
          <span>Roadmap</span>
          <span>Esta semana</span>
          <span>NPS {sample ? `· ${sample.nps.previous.short} e ${sample.nps.current.short}` : ""}</span>
          <span>Folga do mês</span>
          <span className="w-[88px]" />
        </div>
        <ul className="divide-y divide-white/[0.06]">
          {rows.map(({ c, p }) => (
            <PortfolioLine key={c.slug} c={c} p={p} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function PortfolioLine({ c, p }: Row) {
  const pct = c.totalTasks > 0 ? Math.round((c.doneTasks / c.totalTasks) * 100) : 0;
  const left = remainingOf(c);
  return (
    <li className="grid gap-x-4 gap-y-3 px-5 py-4 transition hover:bg-white/[0.025] lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_auto] lg:items-center">
      {/* Projeto */}
      <Link href={`/seo/${c.slug}`} className="flex min-w-0 items-center gap-3">
        {p ? (
          <LogoChip logo={p.logo.src} emoji={null} alt="" gradient={p.logo.gradient} size="sm" bgMode={p.logo.bgMode} sizing={p.logo.sizing} />
        ) : (
          <span className="h-8 w-8 rounded-lg bg-white/[0.06]" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-white hover:underline">{c.title}</span>
          {p?.tier && <span className="text-[11.5px] text-white/40">{TIER_LABEL[p.tier]}</span>}
        </span>
      </Link>

      {/* Roadmap */}
      <div className="min-w-0">
        {c.hasRoadmap ? (
          <>
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="text-white/60">
                Semana <span className="font-semibold text-white/85">{c.currentWeek}</span> de {c.totalWeeks}
              </span>
              <span className={`rounded-full border px-1.5 py-px text-[10.5px] font-medium ${HEALTH[c.health].chip}`}>{HEALTH[c.health].label}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" title={`${c.doneTasks}/${c.totalTasks} tarefas concluídas`}>
              <div className="brand-gradient-bg h-full" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${HEALTH["no-roadmap"].chip}`}>Sem roadmap</span>
        )}
      </div>

      {/* Esta semana */}
      <div className="text-[12.5px]">
        <span className="text-white/40 lg:hidden">Esta semana · </span>
        {!c.hasRoadmap ? (
          <span className="text-white/35">—</span>
        ) : c.thisWeekTasks.length === 0 ? (
          <span className="text-white/40">nada agendado</span>
        ) : left === 0 ? (
          <span className="text-emerald-200">tudo feito</span>
        ) : (
          <span className="text-white/80">
            <span className="font-semibold">{left}</span> por fazer
          </span>
        )}
        {c.pendingApproval > 0 && <span className="block text-[11.5px] text-violet-200/80">{c.pendingApproval} em aprovação</span>}
      </div>

      {/* NPS */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-white/40 lg:hidden">NPS</span>
        {!p || p.nps.excluded ? (
          <span className="text-[12px] text-white/35">não se aplica</span>
        ) : (
          <>
            <NpsPill short={p.nps.previous.short} value={p.nps.previous.score} />
            <NpsPill short={p.nps.current.short} value={p.nps.current.score} state={p.nps.current.state} slug={c.slug} />
          </>
        )}
      </div>

      {/* Folga */}
      <div className="min-w-0">
        <span className="text-[12px] text-white/40 lg:hidden">Folga · </span>
        {p ? <FolgaCell slug={c.slug} f={p.folga} /> : <span className="text-white/35">—</span>}
      </div>

      {/* Atalhos */}
      <div className="flex items-center gap-1 lg:w-[88px] lg:justify-end">
        <IconLink href={`/seo/${c.slug}/roadmap`} label="Abrir roadmap" icon={MapIcon} />
        <IconLink href={`/seo/${c.slug}/folga`} label="Abrir folga de custos" icon={Wallet} />
        <IconLink href={`/seo/${c.slug}`} label="Ficha do cliente" icon={FolderOpen} />
      </div>
    </li>
  );
}

function NpsPill({
  short,
  value,
  state,
  slug,
}: {
  short: string;
  value: number | null;
  state?: "respondido" | "enviado" | "por-enviar";
  slug?: string;
}) {
  if (value !== null) {
    const c = npsScoreColor(value);
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold tabular-nums"
        style={{ color: c, borderColor: `${c}55`, background: `${c}1a` }}
      >
        <span className="text-[10px] font-medium tracking-[0.08em] text-white/55">{short}</span>
        {score(value)}
      </span>
    );
  }
  if (state === "por-enviar" && slug) {
    return (
      <Link
        href={`/seo/${slug}/nps`}
        className="inline-flex items-center gap-1 rounded-full border border-rose-400/45 bg-rose-500/12 px-2 py-0.5 text-[11.5px] font-semibold text-rose-100 hover:bg-rose-500/20"
      >
        <span className="text-[10px] font-medium tracking-[0.08em] text-rose-200/70">{short}</span>
        enviar
      </Link>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11.5px] text-white/40">
      <span className="text-[10px] font-medium tracking-[0.08em]">{short}</span>
      {state === "enviado" ? "enviado" : "—"}
    </span>
  );
}

function FolgaCell({ slug, f }: { slug: string; f: PortfolioRow["folga"] }) {
  const tone = FOLGA_TONE[f.state];
  if (f.pctFree === null) {
    return (
      <Link href={`/seo/${slug}/folga`} className="text-[12.5px] text-white/45 hover:text-white">
        {f.state === "lite" ? "Lite · extras cobrados" : f.remaining < 0 ? eurCents(f.remaining) : "por definir"}
      </Link>
    );
  }
  const width = Math.max(0, Math.min(100, f.pctFree));
  return (
    <Link href={`/seo/${slug}/folga`} className="group block">
      <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className={`font-semibold tabular-nums ${tone.text}`}>{eurCents(f.remaining)}</span>
        <span className="text-[11.5px] tabular-nums text-white/40">{`${f.pctFree}%`.replace("-", "−")} livre</span>
      </span>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
      </span>
    </Link>
  );
}

function IconLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.07] hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Esta semana, projeto a projeto
// ---------------------------------------------------------------------------

function ClientWeekCard({ client, p }: { client: ConsultantWeekClient; p: PortfolioRow | undefined }) {
  const health = HEALTH[client.health];
  const pct = client.totalTasks > 0 ? Math.round((client.doneTasks / client.totalTasks) * 100) : 0;
  const ordered = [...client.thisWeekTasks].sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank);
  const left = remainingOf(client);

  return (
    <article className="flex flex-col rounded-[22px] border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/seo/${client.slug}`} className="flex min-w-0 items-center gap-3">
          {p && <LogoChip logo={p.logo.src} emoji={null} alt="" gradient={p.logo.gradient} size="sm" bgMode={p.logo.bgMode} sizing={p.logo.sizing} />}
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-white hover:underline">{client.title}</h3>
        </Link>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${health.chip}`}>{health.label}</span>
      </div>

      {client.hasRoadmap ? (
        <>
          <div className="mt-4 flex items-baseline justify-between text-[12px] text-white/55">
            <span>
              Semana <span className="font-semibold text-white/85">{client.currentWeek}</span> de {client.totalWeeks}
            </span>
            <span>
              {client.doneTasks}/{client.totalTasks} concluídas
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div className="brand-gradient-bg h-full" style={{ width: `${pct}%` }} />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-white/70">Esta semana</span>
            <span className="text-[12px] text-white/40">
              {left > 0 ? `${left} por fazer` : client.thisWeekTasks.length > 0 ? "tudo feito" : "—"}
            </span>
          </div>
          {client.thisWeekTasks.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[12.5px] text-white/35">
              Nada agendado para a semana {client.currentWeek}.
            </p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {ordered.map((task) => {
                const meta = STATUS[task.status];
                const done = task.status === "implemented";
                return (
                  <li
                    key={task.id}
                    className={`flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 ${done ? "opacity-55" : ""}`}
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13px] leading-snug ${done ? "text-white/55 line-through" : "text-white/90"}`}>
                        {task.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-white/40">
                        <span>{PILLAR[task.pillar] ?? task.pillar}</span>
                        <span className={meta.text}>{meta.label}</span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {(client.overduePastWeeks > 0 || client.pendingApproval > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
              {client.overduePastWeeks > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                  <Clock className="h-3 w-3" />
                  {client.overduePastWeeks} em atraso de semanas anteriores
                </span>
              )}
              {client.pendingApproval > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-violet-200">
                  <CheckCircle2 className="h-3 w-3" />
                  {client.pendingApproval} em aprovação
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-[12.5px] text-white/40">
          Ainda sem roadmap gerado.
        </p>
      )}

      {p && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
          {!p.nps.excluded && (
            <>
              <NpsPill short={p.nps.previous.short} value={p.nps.previous.score} />
              <NpsPill short={p.nps.current.short} value={p.nps.current.score} state={p.nps.current.state} slug={client.slug} />
            </>
          )}
          <Link
            href={`/seo/${client.slug}/folga`}
            className={`ml-auto inline-flex items-center gap-1 text-[12px] tabular-nums hover:text-white ${FOLGA_TONE[p.folga.state].text}`}
          >
            <Wallet className="h-3.5 w-3.5" />
            {p.folga.pctFree === null ? (p.folga.state === "lite" ? "Lite" : "por definir") : eurCents(p.folga.remaining)}
          </Link>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end border-t border-white/[0.06] pt-3">
        <Link
          href={`/seo/${client.slug}/roadmap`}
          className="group inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white/55 transition hover:text-white"
        >
          Abrir roadmap
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
