"use client";

// O PAINEL DE CONTEXTO DO INQUÉRITO NPS (v77.38 → v77.39).
//
// Vive na página pública do inquérito e dá ao cliente — sem sair da página
// — as duas coisas de que precisa para avaliar com factos e não de memória:
// o último relatório mensal e o trabalho concluído nos últimos 3 meses.
//
// Três peças (v77.39, depois de o Andre ver a primeira versão):
//
//  • A PASTILHA FIXA no canto inferior direito — «Consultar · Last Report ·
//    Trabalho feito» — presente do princípio ao fim do formulário, em todos
//    os passos e a qualquer scroll. A barra grande que havia por cima das
//    perguntas saiu: empurrava o formulário para baixo e repetia o que a
//    pastilha já diz.
//  • O CHIP JUNTO AO «Formulário de 5 minutos», com o mesmo tamanho desse
//    chip: a mesma pastilha, em miniatura, no sítio onde o olho pousa antes
//    de começar.
//  • O PAINEL, lateral no desktop e de baixo para cima no telemóvel: abas
//    Relatório / Trabalho, Esc e clique fora fecham, o foco vai para o
//    botão de fechar e volta a quem abriu. O relatório completo carrega
//    dentro do painel só quando se pede (um iframe da página pública —
//    ~140 KB que não pesam no formulário até serem precisos). O trabalho
//    concluído lê-se como uma linha do tempo: um dia de cada vez, com as
//    tarefas desse dia empilhadas e a área de cada uma pela cor.
//
// O componente é um PROVIDER: embrulha a introdução e o formulário, e é
// por contexto React que o chip da introdução abre o mesmo painel que a
// pastilha do canto. Só tipos vêm dos stores; os dados chegam já
// serializados do servidor (getNpsSurveyContext).

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  BookOpenText,
  ChevronDown,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import type { PublicLang } from "@/lib/public-i18n";
import {
  NPS_PILLAR_LABEL,
  NPS_PILLAR_TONE,
  type NpsDoneAction,
  type NpsKpiDelta,
  type NpsReportDigest,
  type NpsSurveyContext,
  type NpsWorkDigest,
} from "@/lib/nps-context-shared";
import { formatDate } from "@/lib/dates";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

type Tab = "report" | "work";

const COPY = {
  pt: {
    tabReport: "Relatório mensal",
    tabWork: "Trabalho concluído",
    drawerEyebrow: "Contexto da tua conta",
    finalized: "Finalizado a",
    generated: "Gerado a",
    consultant: "Consultor",
    partialChip: "Parcial",
    partialNote:
      "Relatório parcial — cobre só parte do mês, por isso não traz comparações com o mês anterior.",
    highlights: "Destaques do mês",
    numbers: "Os números do mês",
    deltaNote: "Variação face ao mês anterior.",
    readFull: "Ler o relatório completo aqui",
    hideFull: "Fechar o relatório completo",
    newTab: "Abrir noutro separador",
    fullHint:
      "O documento completo — com evolução, keywords, IA e Ficha Google — abre aqui dentro ou num separador novo.",
    loadingReport: "A carregar o relatório…",
    frameTitle: "Relatório mensal completo",
    implemented: (n: number) =>
      n === 1 ? "1 ação implementada" : `${n} ações implementadas`,
    window: (a: string, b: string) => `de ${a} a ${b} · últimos 3 meses`,
    byArea: "Por área",
    weekAbbr: "Sem.",
    tasksOnDay: (n: number) => (n === 1 ? "1 tarefa" : `${n} tarefas`),
    openRoadmap: "Abrir o roadmap completo",
    close: "Fechar",
    pillLabel: "Consultar",
    pillReport: "Last Report",
    pillWork: "Trabalho feito",
    emptyWork: "Ainda não há ações concluídas nos últimos 3 meses.",
    months: [
      "jan", "fev", "mar", "abr", "mai", "jun",
      "jul", "ago", "set", "out", "nov", "dez",
    ],
    weekdays: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
  },
  en: {
    tabReport: "Monthly report",
    tabWork: "Work completed",
    drawerEyebrow: "Your account in context",
    finalized: "Finalised on",
    generated: "Generated on",
    consultant: "Consultant",
    partialChip: "Partial",
    partialNote:
      "Partial report — it covers only part of the month, so there are no prior-month comparisons.",
    highlights: "Highlights of the month",
    numbers: "The month in numbers",
    deltaNote: "Change vs. the previous month.",
    readFull: "Read the full report here",
    hideFull: "Close the full report",
    newTab: "Open in a new tab",
    fullHint:
      "The full document — trend, keywords, AI and Google listing — opens right here or in a new tab.",
    loadingReport: "Loading the report…",
    frameTitle: "Full monthly report",
    implemented: (n: number) =>
      n === 1 ? "1 action implemented" : `${n} actions implemented`,
    window: (a: string, b: string) => `from ${a} to ${b} · last 3 months`,
    byArea: "By area",
    weekAbbr: "Wk",
    tasksOnDay: (n: number) => (n === 1 ? "1 task" : `${n} tasks`),
    openRoadmap: "Open the full roadmap",
    close: "Close",
    pillLabel: "Look up",
    pillReport: "Last Report",
    pillWork: "Work done",
    emptyWork: "No actions completed in the last 3 months yet.",
    months: [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ],
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
} as const;

/** `**negrito**` nas frases do resumo executivo — o mesmo formato do
 *  relatório, para a frase ler igual nos dois sítios. */
function boldParts(text: string) {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-black/85">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#A9834F]">
      {children}
    </span>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-6 w-6 items-center justify-center rounded-lg text-white"
        style={{ background: BRAND_GRADIENT }}
      >
        {icon}
      </span>
      <h4 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-black/60">
        {children}
      </h4>
    </div>
  );
}

function DeltaChip({ d }: { d: NpsKpiDelta }) {
  const color = d.dir === "flat" ? "#6d6b86" : d.good ? "#0f8f62" : "#c93a52";
  const Icon = d.dir === "up" ? TrendingUp : d.dir === "down" ? TrendingDown : Minus;
  return (
    <span
      className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
      style={{ color, background: `${color}1a` }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.6} />
      {d.text}
    </span>
  );
}

function PillarChip({
  pillar,
  lang,
  count,
}: {
  pillar: keyof typeof NPS_PILLAR_LABEL;
  lang: PublicLang;
  count?: number;
}) {
  const tone = NPS_PILLAR_TONE[pillar];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: tone,
        background: `${tone}14`,
        boxShadow: `inset 0 0 0 1px ${tone}33`,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: tone }}
      />
      {NPS_PILLAR_LABEL[pillar][lang]}
      {typeof count === "number" && (
        <span className="tabular-nums opacity-80">{count}</span>
      )}
    </span>
  );
}

// ─── A pastilha ──────────────────────────────────────────────────────────
//
// A MESMA peça em dois tamanhos: «md» é a do canto (fixa, com sombra);
// «sm» é o chip da introdução, com a altura do «Formulário de 5 minutos»
// (h-7, texto 11px, fundo branco translúcido) para os dois parecerem
// irmãos e não um botão ao lado de uma etiqueta.

function ContextPill({
  size,
  report,
  work,
  lang,
  onOpen,
}: {
  size: "sm" | "md";
  report: boolean;
  work: boolean;
  lang: PublicLang;
  onOpen: (tab: Tab) => void;
}) {
  const t = COPY[lang];
  const sm = size === "sm";
  const btn = `inline-flex items-center rounded-full font-semibold text-black/70 transition-colors duration-150 hover:bg-[#783DF5]/10 hover:text-[#783DF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]/40 ${
    sm ? "h-[22px] gap-1 px-2 text-[11px]" : "gap-1.5 px-3 py-2 text-[12.5px]"
  }`;
  const icon = sm ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <div
      className={
        sm
          ? "inline-flex h-7 items-center gap-0.5 rounded-full border border-black/10 bg-white/60 p-[3px] pl-2"
          : "flex items-center gap-1 rounded-full border border-black/10 bg-white/95 p-1 shadow-[0_18px_40px_-16px_rgba(23,22,45,0.55)] backdrop-blur-md"
      }
    >
      <span
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-[0.14em] text-black/40 ${
          sm ? "pr-1 text-[10px]" : "hidden pl-3 pr-1 text-[10.5px] sm:inline-flex"
        }`}
      >
        <Sparkles className="h-3 w-3 text-[#783DF5]" />
        {t.pillLabel}
      </span>
      {report && (
        <button type="button" onClick={() => onOpen("report")} className={btn}>
          <BarChart3 className={icon} />
          {t.pillReport}
        </button>
      )}
      {work && (
        <button type="button" onClick={() => onOpen("work")} className={btn}>
          <ListChecks className={icon} />
          {t.pillWork}
        </button>
      )}
    </div>
  );
}

// ─── O relatório ─────────────────────────────────────────────────────────

function ReportPanel({
  report,
  lang,
}: {
  report: NpsReportDigest;
  lang: PublicLang;
}) {
  const t = COPY[lang];
  const [showFull, setShowFull] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFull) return;
    const id = window.setTimeout(
      () =>
        frameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
    return () => window.clearTimeout(id);
  }, [showFull]);

  const dateLine = report.finalizedAt
    ? `${t.finalized} ${formatDate(report.finalizedAt)}`
    : `${t.generated} ${formatDate(report.generatedAt)}`;

  return (
    <div className="space-y-6">
      {/* Capa — a mesma assinatura do relatório. */}
      <div
        className="nps-q-in relative overflow-hidden rounded-3xl p-5 text-white sm:p-6"
        style={{ background: BRAND_GRADIENT }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.28), transparent 68%)",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur-[2px]">
            <FileText className="h-3 w-3" />
            {t.tabReport}
          </span>
          {report.partial && (
            <span className="rounded-full border border-white/35 bg-white/20 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]">
              {t.partialChip}
            </span>
          )}
        </div>
        <h3 className="relative mt-4 text-2xl font-semibold tracking-tight sm:text-[28px]">
          {report.periodLabel}
        </h3>
        <p className="relative mt-1.5 text-[12.5px] text-white/85">
          {dateLine}
          {report.consultantName
            ? ` · ${t.consultant}: ${report.consultantName}`
            : ""}
        </p>
      </div>

      {report.partial && (
        <p className="nps-q-in rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-[12.5px] leading-relaxed text-amber-900/80">
          {t.partialNote}
        </p>
      )}

      {report.highlights.length > 0 && (
        <section className="nps-q-in" style={{ animationDelay: "60ms" }}>
          <SectionLabel icon={<Sparkles className="h-3.5 w-3.5" />}>
            {t.highlights}
          </SectionLabel>
          <ul className="mt-3 space-y-2.5">
            {report.highlights.map((h, i) => (
              <li
                key={i}
                className="nps-q-in flex gap-3 rounded-2xl border border-black/[0.07] bg-white px-4 py-3 text-[14px] leading-relaxed text-black/70"
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                <span
                  aria-hidden
                  className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                  style={{ background: BRAND_GRADIENT }}
                />
                <span>{boldParts(h)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.kpis.length > 0 && (
        <section className="nps-q-in" style={{ animationDelay: "140ms" }}>
          <SectionLabel icon={<BarChart3 className="h-3.5 w-3.5" />}>
            {t.numbers}
          </SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {report.kpis.map((k, i) => (
              <div
                key={k.label}
                className="nps-q-in relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white px-4 py-3.5"
                style={{ animationDelay: `${200 + i * 50}ms` }}
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: BRAND_GRADIENT }}
                />
                <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#8a4fd0]">
                  {k.label}
                </div>
                <div className="mt-1.5 text-[22px] font-semibold tabular-nums leading-none tracking-tight text-black/85">
                  {k.value}
                </div>
                {k.delta && <DeltaChip d={k.delta} />}
              </div>
            ))}
          </div>
          {!report.partial && (
            <p className="mt-2 text-[11px] text-black/40">{t.deltaNote}</p>
          )}
        </section>
      )}

      <section
        className="nps-q-in rounded-3xl border border-black/[0.07] bg-white p-4 sm:p-5"
        style={{ animationDelay: "220ms" }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowFull((v) => !v)}
            aria-expanded={showFull}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]/40"
            style={{ background: BRAND_GRADIENT }}
          >
            {showFull ? (
              <ChevronDown className="h-4 w-4 rotate-180 transition-transform" />
            ) : (
              <BookOpenText className="h-4 w-4" />
            )}
            {showFull ? t.hideFull : t.readFull}
          </button>
          <a
            href={report.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[13px] font-medium text-black/65 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#783DF5]/40 hover:text-[#783DF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]/40"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t.newTab}
          </a>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-black/45">
          {t.fullHint}
        </p>

        {showFull && (
          <div
            ref={frameRef}
            className="relative mt-4 overflow-hidden rounded-2xl border border-black/10 bg-[#f4f4ed]"
            style={{ height: "min(78vh, 920px)", scrollMarginTop: "12px" }}
          >
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] text-black/50">
                <Loader2 className="h-4 w-4 animate-spin text-[#783DF5]" />
                {t.loadingReport}
              </div>
            )}
            <iframe
              title={t.frameTitle}
              src={report.href}
              onLoad={() => setLoaded(true)}
              className="h-full w-full"
              style={{
                border: 0,
                opacity: loaded ? 1 : 0,
                transition: "opacity .35s ease-out",
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

// ─── O trabalho concluído ────────────────────────────────────────────────
//
// LINHA DO TEMPO POR DIA (v77.39). A primeira versão repetia «Sem. 10 ·
// 17/09/2026» em cada linha — e quando o consultor marca dez tarefas na
// mesma tarde, isso é a mesma data dez vezes seguidas. Agora a data
// aparece UMA vez, num selo à esquerda (dia grande, mês, dia da semana e
// semana do roadmap), e as tarefas desse dia empilham-se à direita num
// cartão só, cada uma com a área pela cor da margem e da pastilha. Lê-se
// de cima a baixo como um diário do que foi feito.

type DayGroup = {
  key: string;
  at: number;
  items: NpsDoneAction[];
};

function groupByDay(items: NpsDoneAction[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const it of items) {
    const key = formatDate(it.doneAt);
    const g = map.get(key);
    if (g) g.items.push(it);
    else map.set(key, { key, at: it.doneAt, items: [it] });
  }
  return [...map.values()].sort((a, b) => b.at - a.at);
}

function DayBadge({
  at,
  week,
  lang,
}: {
  at: number;
  week: number;
  lang: PublicLang;
}) {
  const t = COPY[lang];
  const d = new Date(at);
  return (
    <div className="w-[58px] rounded-2xl border border-black/[0.07] bg-white px-1 py-2 text-center shadow-[0_8px_20px_-16px_rgba(23,22,45,0.5)] sm:w-[64px]">
      <div className="text-[20px] font-semibold leading-none tabular-nums tracking-tight text-black/85">
        {d.getDate()}
      </div>
      <div className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#783DF5]">
        {t.months[d.getMonth()]}
      </div>
      <div className="mt-1 border-t border-black/[0.06] pt-1 text-[9.5px] leading-tight text-black/45">
        {t.weekdays[d.getDay()]}
        <br />
        {t.weekAbbr} {week}
      </div>
    </div>
  );
}

function WorkPanel({ work, lang }: { work: NpsWorkDigest; lang: PublicLang }) {
  const t = COPY[lang];
  return (
    <div className="space-y-6">
      <div
        className="nps-q-in relative overflow-hidden rounded-3xl p-5 text-white sm:p-6"
        style={{ background: BRAND_GRADIENT }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.28), transparent 68%)",
          }}
        />
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur-[2px]">
          <ListChecks className="h-3 w-3" />
          {t.tabWork}
        </span>
        <h3 className="relative mt-4 text-2xl font-semibold tracking-tight sm:text-[28px]">
          {t.implemented(work.total)}
        </h3>
        <p className="relative mt-1.5 text-[12.5px] text-white/85">
          {t.window(formatDate(work.since), formatDate(work.until))}
        </p>
      </div>

      {work.byPillar.length > 0 && (
        <div className="nps-q-in" style={{ animationDelay: "60ms" }}>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-black/40">
            {t.byArea}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {work.byPillar.map((p) => (
              <PillarChip
                key={p.pillar}
                pillar={p.pillar}
                lang={lang}
                count={p.count}
              />
            ))}
          </div>
        </div>
      )}

      {work.months.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-6 text-center text-[13px] text-black/50">
          {t.emptyWork}
        </p>
      )}

      {work.months.map((m, mi) => {
        const days = groupByDay(m.items);
        return (
          <section
            key={m.key}
            className="nps-q-in"
            style={{ animationDelay: `${120 + mi * 80}ms` }}
          >
            <div className="flex items-baseline gap-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#783DF5]">
                {m.label}
              </h4>
              <span
                aria-hidden
                className="h-px flex-1"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(120,61,245,0.35), rgba(197,53,201,0))",
                }}
              />
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-black/50">
                {m.items.length}
              </span>
            </div>

            {/* A linha do tempo: o fio à esquerda, os selos de dia em cima
                dele, as tarefas do dia à direita. */}
            <div className="relative mt-4 pl-[72px] sm:pl-[80px]">
              <span
                aria-hidden
                className="absolute bottom-4 left-[29px] top-3 w-px sm:left-[32px]"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(120,61,245,0.45), rgba(120,61,245,0.12) 70%, transparent)",
                }}
              />
              <div className="space-y-3.5">
                {days.map((day, di) => (
                  <div
                    key={day.key}
                    className="nps-q-in relative"
                    style={{ animationDelay: `${160 + mi * 80 + Math.min(di, 6) * 50}ms` }}
                  >
                    <div className="absolute -left-[72px] top-0 sm:-left-[80px]">
                      <DayBadge at={day.at} week={day.items[0].week} lang={lang} />
                    </div>
                    <div className="min-h-[76px] overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                      <div className="flex items-center justify-between border-b border-black/[0.05] bg-[#fbfaf7] px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-black/40">
                        <span>{day.key}</span>
                        <span className="tabular-nums">{t.tasksOnDay(day.items.length)}</span>
                      </div>
                      <ol className="divide-y divide-black/[0.06]">
                        {day.items.map((it) => {
                          const tone = NPS_PILLAR_TONE[it.pillar];
                          return (
                            <li
                              key={it.id}
                              className="flex flex-wrap items-start gap-x-3 gap-y-1.5 py-2.5 pl-3 pr-3.5 transition-colors duration-150 hover:bg-[#f7f5fe]"
                              style={{ boxShadow: `inset 3px 0 0 ${tone}` }}
                            >
                              <span className="min-w-[60%] flex-1 text-pretty text-[13.5px] font-medium leading-snug text-black/80">
                                {it.title}
                              </span>
                              <span className="ml-auto shrink-0">
                                <PillarChip pillar={it.pillar} lang={lang} />
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {work.roadmapHref && (
        <a
          href={work.roadmapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="nps-q-in inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[13px] font-medium text-black/65 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#783DF5]/40 hover:text-[#783DF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]/40"
          style={{ animationDelay: "260ms" }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t.openRoadmap}
        </a>
      )}
    </div>
  );
}

// ─── O provider, a pastilha do canto e o painel ──────────────────────────

type DockApi = {
  openAt: (tab: Tab) => void;
  hasReport: boolean;
  hasWork: boolean;
  lang: PublicLang;
};

const DockContext = createContext<DockApi | null>(null);

/** O chip da introdução — junto ao «Formulário de 5 minutos». Só existe
 *  dentro de um NpsContextDock com alguma coisa para mostrar. */
export function NpsContextChip() {
  const dock = useContext(DockContext);
  if (!dock || (!dock.hasReport && !dock.hasWork)) return null;
  return (
    <ContextPill
      size="sm"
      report={dock.hasReport}
      work={dock.hasWork}
      lang={dock.lang}
      onOpen={dock.openAt}
    />
  );
}

export function NpsContextDock({
  context,
  lang,
  clientName,
  children,
}: {
  context: NpsSurveyContext;
  lang: PublicLang;
  clientName: string;
  children: React.ReactNode;
}) {
  const t = COPY[lang];
  const report = context.report;
  // Um roadmap sem nada concluído nos últimos 3 meses não tem entrada: um
  // «0 ações» ao lado de um pedido de avaliação é a pior introdução possível.
  const work = context.work && context.work.total > 0 ? context.work : null;
  const tabs: Tab[] = [
    ...(report ? (["report"] as Tab[]) : []),
    ...(work ? (["work"] as Tab[]) : []),
  ];

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(tabs[0] ?? "report");
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Painel aberto: a página por trás não rola, Esc fecha, o foco entra —
  // e volta a quem abriu quando fecha.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      lastFocus.current?.focus?.();
    };
  }, [open]);

  const api = useMemo<DockApi>(
    () => ({
      openAt: (next: Tab) => {
        lastFocus.current = document.activeElement as HTMLElement | null;
        setTab(next);
        setOpen(true);
      },
      hasReport: Boolean(report),
      hasWork: Boolean(work),
      lang,
    }),
    [report, work, lang],
  );
  const close = () => setOpen(false);

  return (
    <DockContext.Provider value={api}>
      {children}

      {/* A pastilha do canto — fixa, do primeiro ao último passo. Escondida
          só enquanto o painel está aberto (o véu já a tapava). */}
      {tabs.length > 0 && !open && (
        <div
          className="nps-pill-in fixed right-4 z-[90] sm:right-6"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <ContextPill
            size="md"
            report={Boolean(report)}
            work={Boolean(work)}
            lang={lang}
            onOpen={api.openAt}
          />
        </div>
      )}

      {/* O painel */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100]">
            <div
              aria-hidden
              onClick={close}
              className="nps-overlay-in absolute inset-0 bg-[#17162d]/45 backdrop-blur-[3px]"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="nps-sheet absolute inset-x-0 bottom-0 flex h-[94dvh] flex-col overflow-hidden rounded-t-[28px] bg-[#f6f5f0] shadow-[0_-20px_60px_-30px_rgba(0,0,0,0.5)] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[min(100%,760px)] sm:rounded-none sm:rounded-l-[28px] sm:shadow-[-24px_0_80px_-40px_rgba(0,0,0,0.55)]"
            >
              <header className="shrink-0 border-b border-black/8 bg-white/80 px-5 pb-3 pt-3 backdrop-blur sm:px-8 sm:pt-5">
                <div
                  aria-hidden
                  className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 sm:hidden"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Eyebrow>{t.drawerEyebrow}</Eyebrow>
                    <h2
                      id={titleId}
                      className="truncate text-lg font-semibold tracking-tight text-black/85"
                    >
                      {clientName}
                    </h2>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={close}
                    aria-label={t.close}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/60 transition-all duration-200 hover:border-black/25 hover:text-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]/40"
                  >
                    <X className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                </div>
                {tabs.length > 1 && (
                  <div
                    role="tablist"
                    className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-black/[0.05] p-1"
                  >
                    {tabs.map((k) => {
                      const active = tab === k;
                      const Icon = k === "report" ? BarChart3 : ListChecks;
                      return (
                        <button
                          key={k}
                          role="tab"
                          type="button"
                          aria-selected={active}
                          onClick={() => setTab(k)}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]/40 ${
                            active
                              ? "bg-white text-black/85 shadow-[0_6px_16px_-10px_rgba(0,0,0,0.45)]"
                              : "text-black/50 hover:text-black/75"
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 ${active ? "text-[#783DF5]" : ""}`}
                          />
                          {k === "report" ? t.tabReport : t.tabWork}
                        </button>
                      );
                    })}
                  </div>
                )}
              </header>
              <div
                key={tab}
                className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8"
              >
                {tab === "report" && report && (
                  <ReportPanel report={report} lang={lang} />
                )}
                {tab === "work" && work && <WorkPanel work={work} lang={lang} />}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </DockContext.Provider>
  );
}
