// «O meu painel» das Ineficácias — o lugar do consultor na escala.
//
// v77.91: saiu do topo da página do relatório (o André pediu o formulário
// primeiro) e abre-se pelo botão «O meu painel». v78.71: o histórico dos
// relatórios e das ocorrências da direção.
//
// v80.45 (pedido do André, «melhora 100x este UX e UI»): três perguntas, por
// esta ordem —
//   1. Como estou hoje? O nível em grande, a régua dos 4 níveis e o caminho
//      até ao próximo (PA e NO contra o limiar, o que falta, o próximo reset).
//   2. Como me avalio? «A tua avaliação vs. a da direção» — a calibração.
//   3. O que aconteceu? Todas as ocorrências por mês, com filtros, a tua
//      gravidade e a da direção lado a lado numa régua de 0 a 10 e, quando a
//      direção o mostra, o porquê dos pontos. Depois o percurso na escala e
//      os relatórios assinados (a prova da assinatura).
//
// Os mesmos portões da página do relatório: só o próprio índice, a direção
// vai para o painel da equipa, e «em construção» decide-se por quem fez
// login. Tudo vem de `loadConsultantForSelf`.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  Flag,
  Gauge,
  Hourglass,
  PenLine,
  RotateCcw,
  Route,
  Scale,
  Sigma,
  Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { UnderConstruction } from "@/components/ineficacias/under-construction";
import { LEVEL_TONES } from "@/components/ineficacias/level-gauge";
import { ReportView } from "@/components/ineficacias/report-view";
import { SelfHistory } from "@/components/ineficacias/self-history";
import { getCurrentEmployee, getImpersonation, isRealUserAdmin } from "@/lib/auth/server";
import { ineficaciasAvailable } from "@/lib/ineficacias/access";
import { loadConsultantForSelf } from "@/lib/ineficacias/store";
import { buildSelfPanel, type Calibration, type JourneyItem } from "@/lib/ineficacias/self-panel";
import {
  daysBetweenISO,
  formatISODate,
  inDaysLabel,
  LEVELS,
  phaseOpenLabel,
  type IneficaciaLevel,
  type LedgerState,
} from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "O meu painel · Ineficácias · Wonder Ads",
  robots: { index: false, follow: false },
};

const HEADLINE: Record<IneficaciaLevel, string> = {
  0: "Tudo em ordem",
  1: "1:1 com o líder direto",
  2: "1:1 com o nível acima",
  3: "Probation",
};

function nOf(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/* ------------------------------------------------------------------ */
/*  1. Como estou hoje                                                  */
/* ------------------------------------------------------------------ */

function Meter({ icon: Icon, label, value, limit, tone }: { icon: typeof Sigma; label: string; value: number; limit: number | null; tone: (typeof LEVEL_TONES)[IneficaciaLevel] }) {
  const ratio = limit ? Math.min(1, value / limit) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white/60">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        <p className="tabular text-[13px] text-white/40">
          <span className={`text-[22px] font-bold ${tone.text}`}>{value}</span>
          {limit !== null && <span> / {limit}</span>}
        </p>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={`h-full rounded-full ${tone.dot}`}
          style={{ width: `${Math.max(ratio * 100, value > 0 ? 5 : 0)}%`, boxShadow: `0 0 16px ${tone.glow}` }}
        />
      </div>
    </div>
  );
}

function StatusHero({ state, today }: { state: LedgerState; today: string }) {
  const level = state.level;
  const tone = LEVEL_TONES[level];
  const next = state.next;
  const paLeft = next ? Math.max(0, next.pa - state.pa) : 0;
  const noLeft = next ? Math.max(0, next.no - state.no) : 0;
  const clean = level === 0 && state.pa === 0 && state.no === 0;
  // No nível 0 com contadores, a manchete diz se já está perto do 1.
  const near = Boolean(next && (next.pa - state.pa <= 2 || next.no - state.no <= 1));
  const headline = level === 0 && !clean ? (near ? "Perto do nível 1" : "Dentro do limite") : HEADLINE[level];

  return (
    <section
      aria-label="O teu estado hoje"
      className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-white/[0.02] p-5 sm:p-7"
    >
      <span aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: tone.glow, opacity: 0.32 }} />

      <div className="relative grid gap-7 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        {/* o nível */}
        <div>
          <p className="text-[12px] font-semibold text-white/45">O teu estado hoje · {formatISODate(today)}</p>
          <div className="mt-3 flex items-end gap-4">
            <p className={`tabular text-[84px] font-extrabold leading-[0.8] tracking-[-0.04em] sm:text-[104px] ${tone.text}`}>{level}</p>
            <div className="pb-1.5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/40">Nível</p>
              <p className="mt-0.5 text-[22px] font-semibold leading-tight text-white sm:text-[26px]">{headline}</p>
            </div>
          </div>
          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-white/60">
            {clean
              ? "Sem ocorrências a contar neste momento. Continua assim."
              : state.pendingMeasure
                ? `${LEVELS[state.pendingMeasure.level].measure} A direção vai marcar contigo.`
                : LEVELS[level].measure}
          </p>

          {/* a régua dos 4 níveis */}
          <ol className="mt-6 grid grid-cols-4 gap-1.5" aria-label="Escala de incumprimento">
            {LEVELS.map((l) => {
              const t = LEVEL_TONES[l.level];
              const here = l.level === level;
              const past = l.level < level;
              return (
                <li key={l.level} className="relative">
                  <span
                    className={`block h-2 rounded-full ${here ? t.dot : past ? "bg-white/30" : "bg-white/[0.08]"}`}
                    style={here ? { boxShadow: `0 0 18px ${t.glow}` } : undefined}
                  />
                  <p className={`mt-2 text-[11.5px] font-semibold ${here ? t.text : past ? "text-white/55" : "text-white/30"}`}>{l.title}</p>
                  <p className={`text-[10.5px] leading-snug ${here ? "text-white/55" : "text-white/25"}`}>{l.rule}</p>
                  {here && (
                    <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] ${t.border} ${t.bg} ${t.text}`}>
                      Estás aqui
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* o caminho até ao próximo */}
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4 sm:p-5">
          <p className="text-[13px] font-semibold text-white/85">
            {next ? `Até ao nível ${next.level}` : "Estás no último nível"}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">
            {next
              ? `Sobes quando o PA chega a ${next.pa} ou o NO chega a ${next.no}, o que acontecer primeiro.`
              : "No nível 3 sai-se pelo probation, quando fecha com recuperação."}
          </p>
          <div className="mt-4 space-y-4">
            <Meter icon={Sigma} label="PA · pontos" value={state.pa} limit={next?.pa ?? null} tone={tone} />
            <Meter icon={Gauge} label="NO · ocorrências" value={state.no} limit={next?.no ?? null} tone={tone} />
          </div>
          {next && (
            <p className="mt-4 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-white/70">
              Faltam <strong className="font-semibold text-white">{nOf(paLeft, "ponto", "pontos")}</strong> ou{" "}
              <strong className="font-semibold text-white">{nOf(noLeft, "ocorrência pontuada", "ocorrências pontuadas")}</strong> para o
              nível {next.level}.
            </p>
          )}
          <ul className="mt-3 space-y-1.5 text-[11.5px] text-white/45">
            <li className="flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              {state.phaseOpen
                ? `Contam desde ${formatISODate(state.phaseStart ?? state.phaseOpen.at)}, depois de ${phaseOpenLabel(state.phaseOpen)}.`
                : "Contam desde o início."}
            </li>
            {state.nextReset && (
              <li className="flex items-center gap-1.5 text-emerald-300/75">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                Próximo reset a {formatISODate(state.nextReset.at)} ({inDaysLabel(daysBetweenISO(today, state.nextReset.at))}): nível 0, PA e NO a zero.
              </li>
            )}
            {state.unscored > 0 && (
              <li className="flex items-center gap-1.5 text-[#c3aaff]/85">
                <Hourglass className="h-3.5 w-3.5 shrink-0" />
                {nOf(state.unscored, "ocorrência", "ocorrências")} à espera da direção — entram nas contas quando forem pontuadas.
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Como me avalio                                                   */
/* ------------------------------------------------------------------ */

function fmt1(n: number): string {
  return n.toLocaleString("pt-PT", { maximumFractionDigits: 1, minimumFractionDigits: n % 1 ? 1 : 0 });
}

function CalibrationCard({ c }: { c: Calibration }) {
  const diff = c.avgDir - c.avgSelf;
  const insight =
    c.n === 0
      ? "Quando a direção pontuar um erro que reportaste, comparas aqui a tua gravidade com a dela."
      : c.same === c.n
        ? "A tua avaliação bate certo com a da direção. É isto que se pede."
        : c.above > c.below && diff >= 0.5
          ? "A direção tende a pontuar acima de ti. Considera tudo o que o erro causou: refazer, prazos, o cliente."
          : c.below > c.above && diff <= -0.5
            ? "Avalias-te com mais severidade do que a direção."
            : "Ficas perto da direção: umas vezes acima, outras abaixo.";
  const stat = (n: number, label: string, cls: string) => (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
      <p className={`tabular text-[22px] font-bold leading-none ${cls}`}>{n}</p>
      <p className="mt-1 text-[11px] text-white/45">{label}</p>
    </div>
  );
  return (
    <section aria-label="A tua avaliação vs. a da direção" className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Scale className="h-4 w-4 text-[#c3aaff]" />A tua avaliação vs. a da direção
      </h2>
      {c.n > 0 && (
        <>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-[13px] text-white/55">
            Em média: tu <span className="tabular text-[20px] font-bold text-white">{fmt1(c.avgSelf)}</span>
            <span className="text-white/30">·</span>
            direção <span className="tabular text-[20px] font-bold text-white">{fmt1(c.avgDir)}</span>
            <span className="text-white/35">em {nOf(c.n, "erro", "erros")}</span>
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {stat(c.same, "Igual", "text-emerald-300")}
            {stat(c.above, "Direção acima", "text-rose-300")}
            {stat(c.below, "Direção abaixo", "text-sky-300")}
          </div>
        </>
      )}
      <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-white/55">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c3aaff]" />
        {insight}
      </p>
    </section>
  );
}

function Totals({ counts }: { counts: { todas: number; reportadas: number; direcao: number; conta: number } }) {
  const cell = (value: number, label: string, cls = "text-white") => (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
      <p className={`tabular text-[26px] font-bold leading-none ${cls}`}>{value}</p>
      <p className="mt-1 text-[11.5px] text-white/45">{label}</p>
    </div>
  );
  return (
    <section aria-label="Em números" className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Flag className="h-4 w-4 text-[#c3aaff]" />
        Em números
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {cell(counts.todas, "Ocorrências no histórico")}
        {cell(counts.conta, "A contar agora", counts.conta ? "text-amber-200" : "text-white")}
        {cell(counts.reportadas, "Reportadas por ti")}
        {cell(counts.direcao, "Registadas pela direção", counts.direcao ? "text-amber-200/90" : "text-white")}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Percurso                                                         */
/* ------------------------------------------------------------------ */

const JOURNEY_TONE: Record<JourneyItem["kind"], string> = {
  subida: "bg-amber-400",
  direcao: "bg-orange-400",
  semestre: "bg-emerald-400",
  recuperado: "bg-emerald-400",
  medida: "bg-[#a78bfa]",
};

function Journey({ items }: { items: JourneyItem[] }) {
  return (
    <ol className="relative space-y-4 border-l border-white/[0.1] pl-5">
      {items.map((j, i) => (
        <li key={`${j.at}-${i}`} className="relative">
          <span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-[color:var(--background)] ${JOURNEY_TONE[j.kind]}`} />
          <p className="text-[11px] text-white/40">{formatISODate(j.at)}</p>
          <p className="text-[13px] font-semibold text-white/85">{j.title}</p>
          {j.detail.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[12px] text-white/55">
              {j.detail.map((d) => (
                <li key={d}>• {d}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

function SectionTitle({ icon: Icon, title, aside }: { icon: typeof Route; title: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight text-white">
        <Icon className="h-[18px] w-[18px] text-[#c3aaff]" />
        {title}
      </h2>
      {aside}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default async function IneficaciasPainelPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login?next=/ineficacias/painel");
  if (me.viewerOf) return null;
  const impersonation = await getImpersonation().catch(() => null);
  if (me.isAdmin && !impersonation) redirect("/admin/ineficacias");

  if (!ineficaciasAvailable(await isRealUserAdmin())) {
    return (
      <PageShell backHref="/" backLabel="Início">
        <UnderConstruction name={me.name} />
      </PageShell>
    );
  }

  const today = todayLisbonISO();
  const { state, reports, ledger } = await loadConsultantForSelf(me.username, today);
  const panel = buildSelfPanel(reports, ledger, state);

  return (
    <PageShell backHref="/ineficacias" backLabel="Team Inefficiency">
      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout text-white/35">Ineficácias · Team Inefficiency</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">O meu painel</span>
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/55">
            Onde estás na escala, como a direção pontuou cada erro e como isso compara com a tua avaliação.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/documentacao/ineficacias"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12.5px] font-semibold text-white/70 transition hover:text-white"
          >
            <BookOpen className="h-4 w-4" />
            Como funciona
          </Link>
          <Link
            href="/ineficacias"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_14px_40px_-14px_rgba(120,61,245,0.8)] transition hover:-translate-y-0.5 hover:brightness-110"
            style={{ background: "var(--brand-gradient)" }}
          >
            <PenLine className="h-4 w-4" />
            Reportar um erro
          </Link>
        </div>
      </header>

      {state.pendingMeasure && (
        <p className="animate-fade-up mt-6 flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-[13px] leading-relaxed text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <strong className="font-semibold">Atingiste o nível {state.pendingMeasure.level}</strong> a{" "}
            {formatISODate(state.pendingMeasure.since)} (PA {state.pendingMeasure.pa} · NO {state.pendingMeasure.no}).{" "}
            {LEVELS[state.pendingMeasure.level].measure} A direção vai marcar contigo. Os teus contadores recomeçaram do zero
            no dia seguinte.
          </span>
        </p>
      )}

      <div className="animate-fade-up mt-6">
        <StatusHero state={state} today={today} />
      </div>

      <div className="animate-fade-up mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <CalibrationCard c={panel.calibration} />
        <Totals counts={panel.counts} />
      </div>

      <section className="animate-fade-up mt-12" aria-label="As tuas ocorrências">
        <SectionTitle
          icon={Gauge}
          title="As tuas ocorrências"
          aside={<span className="text-[12px] text-white/40">A tua gravidade (○) e a da direção (●), de 0 a 10</span>}
        />
        {panel.entries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/12 px-6 py-10 text-center">
            <p className="text-[15px] font-semibold text-white/80">Ainda não há ocorrências</p>
            <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-white/45">
              Quando reportares um erro, ou a direção registar uma ineficácia, aparece aqui com a tua avaliação e a pontuação
              da direção.
            </p>
            <Link href="/ineficacias" className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#c3aaff] hover:underline">
              Reportar um erro <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <SelfHistory panel={panel} />
        )}
      </section>

      {panel.journey.length > 0 && (
        <section className="animate-fade-up mt-12" aria-label="O teu percurso na escala">
          <SectionTitle icon={Route} title="O teu percurso na escala" />
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
            <Journey items={panel.journey} />
          </div>
        </section>
      )}

      {reports.length > 0 && (
        <section className="animate-fade-up mt-12" aria-label="Os teus relatórios assinados">
          <SectionTitle
            icon={PenLine}
            title="Os teus relatórios assinados"
            aside={<span className="tabular text-[12px] text-white/40">{nOf(reports.length, "relatório", "relatórios")}</span>}
          />
          <p className="-mt-2 mb-3 text-[12px] text-white/45">A assinatura, a hora e o código de integridade de cada relatório.</p>
          <div className="space-y-3">
            {reports.map((r) => (
              <ReportView key={r.id} report={r} audience="consultor" />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
