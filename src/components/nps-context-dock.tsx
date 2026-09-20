"use client";

// O PAINEL DE CONTEXTO DO INQUÉRITO NPS (v77.38).
//
// Vive na página pública do inquérito, entre a introdução e o formulário,
// e dá ao cliente — sem sair da página — as duas coisas de que precisa para
// avaliar com factos e não de memória: o último relatório mensal e o
// trabalho concluído nos últimos 3 meses. Três peças:
//
//  • A BARRA, por cima do formulário: um cartão por fonte (relatório /
//    trabalho), com uma amostra do conteúdo (o mês, três números; a
//    contagem, três títulos). Clicar abre o painel nessa aba; o «↗» no
//    canto abre a versão pública noutro separador.
//  • A PASTILHA FLUTUANTE, no canto inferior direito: só aparece quando a
//    barra saiu do ecrã (o cliente está a meio de uma secção comprida) e o
//    painel está fechado. Nunca tapa nada enquanto a barra está à vista.
//  • O PAINEL, lateral no desktop e de baixo para cima no telemóvel: abas
//    Relatório / Trabalho, Esc e clique fora fecham, o foco vai para o
//    botão de fechar e volta a quem abriu. O relatório completo carrega
//    dentro do painel só quando se pede (um iframe da página pública —
//    ~140 KB que não pesam no formulário até serem precisos).
//
// Só tipos vêm dos stores; os dados chegam já serializados do servidor
// (getNpsSurveyContext), por isso este ficheiro não sabe o que é o KV.

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  BarChart3,
  BookOpenText,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
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
    eyebrow: "Antes de avaliar",
    lead: "Consulta o que fizemos por ti — sem sair do formulário.",
    sub: "O último relatório mensal e o trabalho concluído nos últimos 3 meses, à mão para cada resposta.",
    reportCard: "Relatório mensal",
    workCard: "Trabalho concluído",
    open: "Consultar",
    newTab: "Abrir noutro separador",
    last3: "últimos 3 meses",
    actions: (n: number) =>
      n === 1 ? "1 ação concluída" : `${n} ações concluídas`,
    implemented: (n: number) =>
      n === 1 ? "1 ação implementada" : `${n} ações implementadas`,
    window: (a: string, b: string) => `de ${a} a ${b} · últimos 3 meses`,
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
    fullHint:
      "O documento completo — com evolução, keywords, IA e Ficha Google — abre aqui dentro ou num separador novo.",
    loadingReport: "A carregar o relatório…",
    frameTitle: "Relatório mensal completo",
    byArea: "Por área",
    weekAbbr: "Sem.",
    openRoadmap: "Abrir o roadmap completo",
    close: "Fechar",
    pillLabel: "Consultar",
    pillReport: "Relatório",
    pillWork: "Trabalho feito",
    pillMobile: "Relatório & trabalho feito",
    emptyWork: "Ainda não há ações concluídas nos últimos 3 meses.",
  },
  en: {
    eyebrow: "Before you rate",
    lead: "See what we did for you — without leaving the form.",
    sub: "The latest monthly report and the work completed in the last 3 months, at hand for every answer.",
    reportCard: "Monthly report",
    workCard: "Work completed",
    open: "View",
    newTab: "Open in a new tab",
    last3: "last 3 months",
    actions: (n: number) =>
      n === 1 ? "1 action completed" : `${n} actions completed`,
    implemented: (n: number) =>
      n === 1 ? "1 action implemented" : `${n} actions implemented`,
    window: (a: string, b: string) => `from ${a} to ${b} · last 3 months`,
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
    fullHint:
      "The full document — trend, keywords, AI and Google listing — opens right here or in a new tab.",
    loadingReport: "Loading the report…",
    frameTitle: "Full monthly report",
    byArea: "By area",
    weekAbbr: "Wk",
    openRoadmap: "Open the full roadmap",
    close: "Close",
    pillLabel: "Look up",
    pillReport: "Report",
    pillWork: "Work done",
    pillMobile: "Report & work done",
    emptyWork: "No actions completed in the last 3 months yet.",
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
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
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

/** Um cartão da barra: o botão é o cartão inteiro; o «↗» é um link à parte
 *  (um link dentro de um botão não é HTML válido nem acessível). */
function ContextCard({
  icon,
  title,
  headline,
  meta,
  preview,
  href,
  onOpen,
  lang,
}: {
  icon: React.ReactNode;
  title: string;
  headline: string;
  meta: string;
  preview: React.ReactNode;
  href: string | null;
  onOpen: () => void;
  lang: PublicLang;
}) {
  const t = COPY[lang];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col rounded-2xl border border-black/[0.08] bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-[2px] hover:border-[#783DF5]/40 hover:shadow-[0_16px_34px_-22px_rgba(120,61,245,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]/40 active:scale-[0.995]"
      >
        <span className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm shadow-[#783DF5]/30"
            style={{ background: BRAND_GRADIENT }}
          >
            {icon}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">
            {title}
          </span>
        </span>
        <span className="mt-3 pr-8 text-[17px] font-semibold leading-tight tracking-tight text-black/85">
          {headline}
        </span>
        <span className="mt-0.5 text-[12px] text-black/45">{meta}</span>
        <span className="mt-3 flex-1">{preview}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#783DF5]">
          {t.open}
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </button>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.newTab}
          title={t.newTab}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-black/45 transition-all duration-200 hover:-translate-y-[1px] hover:border-[#783DF5]/40 hover:text-[#783DF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]/40"
        >
          <ArrowUpRight className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

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

      {work.months.map((m, mi) => (
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
            <span className="text-[11px] font-semibold tabular-nums text-black/40">
              {m.items.length}
            </span>
          </div>
          <ol className="mt-3 space-y-2">
            {m.items.map((it, i) => (
              <li
                key={it.id}
                className="nps-q-in flex items-start gap-3 rounded-2xl border border-black/[0.07] bg-white px-4 py-3 transition-colors duration-200 hover:border-black/[0.14]"
                style={{ animationDelay: `${160 + mi * 80 + Math.min(i, 8) * 40}ms` }}
              >
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(5,150,105,0.12)", color: "#059669" }}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-snug text-black/85">
                    {it.title}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-black/45">
                    <PillarChip pillar={it.pillar} lang={lang} />
                    <span>
                      {t.weekAbbr} {it.week}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(it.doneAt)}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

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

export function NpsContextDock({
  context,
  lang,
  clientName,
}: {
  context: NpsSurveyContext;
  lang: PublicLang;
  clientName: string;
}) {
  const t = COPY[lang];
  const report = context.report;
  // Um roadmap sem nada concluído nos últimos 3 meses não tem cartão: um
  // «0 ações» ao lado de um pedido de avaliação é a pior introdução possível.
  const work = context.work && context.work.total > 0 ? context.work : null;
  const tabs: Tab[] = [
    ...(report ? (["report"] as Tab[]) : []),
    ...(work ? (["work"] as Tab[]) : []),
  ];

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(tabs[0] ?? "report");
  const [barVisible, setBarVisible] = useState(true);
  const barRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // A pastilha flutuante só entra quando a barra saiu de cena.
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setBarVisible(entry.isIntersecting),
      { rootMargin: "-24px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Painel aberto: a página por trás não rola, Esc fecha, o foco entra.
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

  if (tabs.length === 0) return null;

  function openAt(next: Tab) {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setTab(next);
    setOpen(true);
  }
  const close = () => setOpen(false);

  const reportPreview = report ? (
    <span className="flex flex-wrap gap-1.5">
      {report.kpis.slice(0, 3).map((k) => (
        <span
          key={k.label}
          className="inline-flex items-baseline gap-1 rounded-lg bg-[#f7f5fe] px-2 py-1 text-[11px] text-black/55"
        >
          <span className="text-[13px] font-semibold tabular-nums text-black/80">
            {k.value}
          </span>
          {k.label}
        </span>
      ))}
      {report.kpis.length === 0 && report.highlights[0] && (
        <span className="line-clamp-2 text-[12px] leading-relaxed text-black/55">
          {report.highlights[0].replaceAll("**", "")}
        </span>
      )}
    </span>
  ) : null;

  const workPreview = work ? (
    <span className="flex flex-col gap-1">
      {work.months
        .flatMap((m) => m.items)
        .slice(0, 3)
        .map((it) => (
          <span
            key={it.id}
            className="flex items-center gap-2 text-[12px] text-black/60"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: NPS_PILLAR_TONE[it.pillar] }}
            />
            <span className="truncate">{it.title}</span>
          </span>
        ))}
      {work.total > 3 && (
        <span className="text-[11px] text-black/40">+{work.total - 3}</span>
      )}
    </span>
  ) : null;

  return (
    <>
      {/* A barra */}
      <div ref={barRef} className="nps-q-in mb-8">
        <div className="relative overflow-hidden rounded-3xl border border-black/8 bg-white/75 p-5 shadow-[0_18px_50px_-36px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-6">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
            style={{ background: BRAND_GRADIENT }}
          />
          <div className="flex items-start justify-between gap-3">
            <div>
              <Eyebrow>{t.eyebrow}</Eyebrow>
              <p className="mt-1 text-[15.5px] font-semibold leading-snug tracking-tight text-black/85">
                {t.lead}
              </p>
              <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-black/50">
                {t.sub}
              </p>
            </div>
            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[#783DF5]" />
          </div>
          <div
            className={`mt-4 grid gap-3 ${tabs.length > 1 ? "sm:grid-cols-2" : ""}`}
          >
            {report && (
              <ContextCard
                icon={<BarChart3 className="h-3.5 w-3.5" />}
                title={t.reportCard}
                headline={report.periodLabel}
                meta={
                  report.finalizedAt
                    ? `${t.finalized} ${formatDate(report.finalizedAt)}`
                    : `${t.generated} ${formatDate(report.generatedAt)}`
                }
                preview={reportPreview}
                href={report.href}
                onOpen={() => openAt("report")}
                lang={lang}
              />
            )}
            {work && (
              <ContextCard
                icon={<ListChecks className="h-3.5 w-3.5" />}
                title={t.workCard}
                headline={t.actions(work.total)}
                meta={t.last3}
                preview={workPreview}
                href={work.roadmapHref}
                onOpen={() => openAt("work")}
                lang={lang}
              />
            )}
          </div>
        </div>
      </div>

      {/* A pastilha flutuante */}
      {!barVisible && !open && (
        <div className="nps-pill-in fixed bottom-4 right-4 z-[90] sm:bottom-6 sm:right-6">
          <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white/95 p-1 shadow-[0_18px_40px_-16px_rgba(23,22,45,0.55)] backdrop-blur-md">
            <span className="hidden items-center gap-1 pl-3 pr-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/40 sm:inline-flex">
              <Sparkles className="h-3 w-3 text-[#783DF5]" />
              {t.pillLabel}
            </span>
            {report && (
              <button
                type="button"
                onClick={() => openAt("report")}
                className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold text-black/70 transition hover:bg-[#783DF5]/10 hover:text-[#783DF5] sm:inline-flex"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                {t.pillReport}
              </button>
            )}
            {work && (
              <button
                type="button"
                onClick={() => openAt("work")}
                className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold text-black/70 transition hover:bg-[#783DF5]/10 hover:text-[#783DF5] sm:inline-flex"
              >
                <ListChecks className="h-3.5 w-3.5" />
                {t.pillWork}
              </button>
            )}
            {/* Telemóvel: um botão só; as abas ficam dentro do painel. */}
            <button
              type="button"
              onClick={() => openAt(tabs[0])}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-white sm:hidden"
              style={{ background: BRAND_GRADIENT }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t.pillMobile}
            </button>
          </div>
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
    </>
  );
}
