"use client";

// Estúdio de Weekly Reports — cinco dias de notas internas entram, sai uma
// mensagem por cliente, pronta a colar no grupo de WhatsApp dele.
//
// DESENHO (v76.73)
//
// • O QUE SE VÊ NO FIM É O QUE O CLIENTE VÊ. A mensagem aparece dentro de uma
//   bolha de WhatsApp a sério — verde, com hora e os dois visos. Não é
//   enfeite: a única pergunta que o consultor tem antes de enviar é «isto lê-se
//   bem no grupo?», e uma textarea cinzenta não responde a isso. Toda a
//   restante página é sóbria de propósito para esta ser a única coisa que
//   salta à vista.
//
// • CINCO BLOCOS, UM POR DIA ÚTIL. É a forma do material de origem: o
//   consultor não tem a semana num sítio, tem-na espalhada por cinco mensagens
//   escritas em cinco dias. Cola-se dia a dia, sem juntar nada primeiro, e
//   vê-se logo qual é o dia que falta. O dia vazio não é erro.
//
// • A CALHA MOSTRA O QUE A APP ESTÁ MESMO A FAZER. Dias → clientes → roadmaps
//   → mensagens, cada etapa com o seu número verdadeiro. Substituiu um spinner
//   que escondia dez chamadas ao modelo: agora o agrupamento aparece em menos
//   de um segundo e vê-se logo se um nome não bateu com a carteira.
//
// • CADA CLIENTE VIVE A SUA VIDA. Uma mensagem por chamada: fica pronta quando
//   fica, uma falha não arrasta as outras, e regenerar um cliente não obriga a
//   regenerar a carteira toda.
//
// • O QUE SAI É EDITÁVEL. A mensagem vai para um cliente que paga; o consultor
//   é o último a ler antes de enviar e tem de poder corrigir uma palavra sem
//   voltar a gerar tudo.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Undo2,
  Wand2,
} from "lucide-react";
import type { WeeklyPlanClient } from "@/lib/seo-tools/weekly-plan";

type CardStatus = "queued" | "writing" | "ready" | "error";

type Card = {
  plan: WeeklyPlanClient;
  status: CardStatus;
  message: string;
  draft: string;
  error: string | null;
};

/** Quantas mensagens se escrevem ao mesmo tempo. Três chega para a carteira
 *  toda ficar pronta em segundos sem atirar vinte pedidos de uma vez. */
const CONCURRENCY = 3;

/** Nomes de cliente que aparecem num bloco de texto, normalizados.
 *
 *  Serve só para o contador ao vivo — dá ao consultor a confirmação imediata
 *  de que os cabeçalhos que escreveu estão a ser lidos como clientes, antes de
 *  gastar uma geração para descobrir que faltavam os dois pontos. O
 *  agrupamento a sério (com a tolerância a erros de escrita) é feito no
 *  servidor, em parseDailyUpdates. */
function clientNamesIn(text: string): Set<string> {
  const names = new Set<string>();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.endsWith(":") || t.length > 61) continue;
    if (/^\s*(?:[•·▪◦*\-–—]|\d+[.)])\s+/.test(t)) continue;
    if (/^(daily\s*update|update\s*di[áa]rio|resumo\s*do\s*dia|daily)\b/i.test(t))
      continue;
    const name = t.slice(0, -1).trim();
    if (!name || /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(name)) continue;
    names.add(
      name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ""),
    );
  }
  return names;
}

export function WeeklyReportStudio({
  days,
}: {
  days: { label: string; date: string }[];
}) {
  const [texts, setTexts] = useState<string[]>(() => days.map(() => ""));
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const filledDays = texts.filter((t) => t.trim()).length;
  /** Um conjunto de nomes por dia, e o conjunto da semana inteira. */
  const perDay = useMemo(() => texts.map(clientNamesIn), [texts]);
  const detected = useMemo(
    () => new Set(perDay.flatMap((s) => [...s])).size,
    [perDay],
  );

  const counts = useMemo(() => {
    if (!cards) return null;
    return {
      clients: cards.length,
      roadmaps: cards.filter((c) => (c.plan.roadmap?.tasks.length ?? 0) > 0)
        .length,
      ready: cards.filter((c) => c.status === "ready").length,
      failed: cards.filter((c) => c.status === "error").length,
    };
  }, [cards]);

  const writeOne = useCallback(
    async (plan: WeeklyPlanClient, extra: string) => {
      setCards((cur) =>
        cur?.map((c) =>
          c.plan.key === plan.key ? { ...c, status: "writing", error: null } : c,
        ) ?? cur,
      );
      try {
        const res = await fetch("/api/seo/weekly-reports/message", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug: plan.slug,
            title: plan.title,
            items: plan.items,
            ...(extra ? { instructions: extra } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setCards((cur) =>
          cur?.map((c) =>
            c.plan.key === plan.key
              ? {
                  ...c,
                  status: "ready",
                  message: data.message as string,
                  draft: data.message as string,
                  error: null,
                }
              : c,
          ) ?? cur,
        );
      } catch (err) {
        setCards((cur) =>
          cur?.map((c) =>
            c.plan.key === plan.key
              ? {
                  ...c,
                  status: "error",
                  error: err instanceof Error ? err.message : String(err),
                }
              : c,
          ) ?? cur,
        );
      }
    },
    [],
  );

  const generate = useCallback(async () => {
    setPlanning(true);
    setError(null);
    setCards(null);
    const extra = instructions.trim();
    try {
      const res = await fetch("/api/seo/weekly-reports/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          blocks: days.map((d, i) => ({
            label: `${d.label} ${d.date}`,
            text: texts[i] ?? "",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      const plan = data.clients as WeeklyPlanClient[];
      setCards(
        plan.map((p) => ({
          plan: p,
          status: "queued" as const,
          message: "",
          draft: "",
          error: null,
        })),
      );
      setPlanning(false);
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );

      // Fila com largura fixa: três mensagens ao mesmo tempo, na ordem em que
      // os clientes aparecem na semana.
      let cursor = 0;
      const worker = async () => {
        while (cursor < plan.length) {
          const mine = plan[cursor++];
          await writeOne(mine, extra);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, plan.length) }, worker),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPlanning(false);
    }
  }, [days, texts, instructions, writeOne]);

  const busy = planning || (cards?.some((c) => c.status !== "ready" && c.status !== "error") ?? false);

  return (
    <>
      {/* ─────────── 1 · A semana ─────────── */}
      <section className="animate-fade-up mt-10">
        <StepHeader
          step="1"
          title="A semana, dia a dia"
          hint="Cola cada daily update tal como o escreveste no grupo interno. Dias sem update ficam em branco."
          meta={
            <span className="tabular text-[11.5px] text-white/45">
              {filledDays} de {days.length} dias
              {detected > 0 && (
                <>
                  <span className="mx-1.5 text-white/20">·</span>
                  <span className="text-[color:var(--brand-purple)]">
                    {detected} cliente{detected === 1 ? "" : "s"} à vista
                  </span>
                </>
              )}
            </span>
          }
        />

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {days.map((d, i) => (
            <DaySlip
              key={d.label}
              label={d.label}
              date={d.date}
              value={texts[i] ?? ""}
              clients={perDay[i]?.size ?? 0}
              first={i === 0}
              onChange={(v) =>
                setTexts((cur) => {
                  const next = [...cur];
                  next[i] = v;
                  return next;
                })
              }
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy || filledDays === 0}
            className="brand-gradient-bg group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(120,61,245,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
            )}
            {busy ? "A escrever…" : "Escrever as mensagens"}
          </button>

          <button
            type="button"
            onClick={() => setShowInstructions((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-3 text-[12.5px] font-medium transition ${
              showInstructions || instructions.trim()
                ? "border-[color:var(--brand-purple)]/60 bg-[color:var(--brand-purple)]/15 text-white"
                : "border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white"
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Instruções extra
          </button>

          {(filledDays > 0 || cards) && (
            <button
              type="button"
              onClick={() => {
                setTexts(days.map(() => ""));
                setCards(null);
                setError(null);
              }}
              className="ml-auto text-[12px] text-white/35 underline-offset-4 transition hover:text-white/70 hover:underline"
            >
              Limpar tudo
            </button>
          )}
        </div>

        {showInstructions && (
          <div className="animate-fade-up mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
            <label
              htmlFor="wr-instructions"
              className="readout block text-white/40"
            >
              Aplica-se a todos os clientes
            </label>
            <textarea
              id="wr-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="ex.: tom mais caloroso; menciona que estamos disponíveis para uma call…"
              className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12.5px] text-white/90 outline-none transition placeholder:text-white/20 focus:border-[color:var(--brand-purple)]/60"
            />
          </div>
        )}

        {error && (
          <p className="animate-fade-up mt-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/[0.07] px-4 py-3 text-[12.5px] leading-relaxed text-rose-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </section>

      {/* ─────────── A calha: o que a app faz entre uma coisa e outra ─────────── */}
      <StageRail
        planning={planning}
        days={filledDays}
        counts={counts}
        detected={detected}
      />

      {/* ─────────── 2 · As mensagens ─────────── */}
      {cards && cards.length > 0 && (
        <section ref={resultsRef} className="animate-fade-up mt-8 scroll-mt-6">
          <StepHeader
            step="2"
            title={`${cards.length} mensagem${cards.length === 1 ? "" : "s"} para enviar`}
            hint="Lê antes de enviar. Cada uma vai para o grupo de WhatsApp do cliente respetivo."
            meta={
              <button
                type="button"
                onClick={() => void generate()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                Regenerar tudo
              </button>
            }
          />

          <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
            {cards.map((card, i) => (
              <ReportCard
                key={card.plan.key}
                card={card}
                index={i}
                onDraft={(v) =>
                  setCards(
                    (cur) =>
                      cur?.map((c) =>
                        c.plan.key === card.plan.key ? { ...c, draft: v } : c,
                      ) ?? cur,
                  )
                }
                onRegenerate={() => void writeOne(card.plan, instructions.trim())}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ─────────────────────────── peças ─────────────────────────── */

function StepHeader({
  step,
  title,
  hint,
  meta,
}: {
  step: string;
  title: string;
  hint: string;
  meta?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-white/[0.07] pb-3">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="tabular text-[13px] font-semibold text-[color:var(--brand-purple)]">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-white">
            {title}
          </h2>
          <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-white/45">
            {hint}
          </p>
        </div>
      </div>
      {meta}
    </header>
  );
}

function DaySlip({
  label,
  date,
  value,
  clients,
  first,
  onChange,
}: {
  label: string;
  date: string;
  value: string;
  /** Nomes de cliente lidos neste dia — confirmação ao vivo de que os
   *  cabeçalhos estão a ser reconhecidos. */
  clients: number;
  first: boolean;
  onChange: (v: string) => void;
}) {
  const filled = value.trim().length > 0;
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border transition ${
        filled
          ? "border-[color:var(--brand-purple)]/40 bg-white/[0.045]"
          : "border-white/[0.08] bg-white/[0.015] hover:border-white/20"
      }`}
    >
      {/* Fita do dia: acende quando o dia tem texto. */}
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-px transition ${
          filled ? "brand-gradient-bg" : "bg-white/[0.06]"
        }`}
      />
      <div className="flex items-baseline justify-between gap-2 px-3 pb-2 pt-3">
        <span
          className={`text-[13.5px] font-semibold tracking-[-0.01em] transition ${
            filled ? "text-white" : "text-white/50"
          }`}
        >
          {label}
        </span>
        <span className="tabular text-[10.5px] text-white/30">{date}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={9}
        aria-label={`Daily update de ${label} ${date}`}
        placeholder={
          first ? "White Clinic:\n• Corrigidos os apontamentos de DNS" : "Cola aqui…"
        }
        className="w-full flex-1 resize-y border-0 bg-transparent px-3 text-[12px] leading-[1.6] text-white/90 outline-none placeholder:text-white/[0.16] focus:ring-0"
      />
      <div className="flex h-6 items-center px-3 pb-2.5">
        {filled && (
          <span
            className={`readout transition ${
              clients > 0
                ? "text-[color:var(--brand-purple)]"
                : "text-amber-300/70"
            }`}
          >
            {clients > 0
              ? `${clients} cliente${clients === 1 ? "" : "s"}`
              : "sem nomes"}
          </span>
        )}
      </div>
    </div>
  );
}

function StageRail({
  planning,
  days,
  detected,
  counts,
}: {
  planning: boolean;
  days: number;
  detected: number;
  counts: {
    clients: number;
    roadmaps: number;
    ready: number;
    failed: number;
  } | null;
}) {
  const stages = [
    {
      label: "Dias colados",
      value: days > 0 ? String(days) : "—",
      done: days > 0,
    },
    {
      label: "Clientes agrupados",
      // Antes de gerar mostra-se o que se vê no texto colado, a cinzento —
      // é uma leitura, não um resultado.
      value: counts ? String(counts.clients) : detected > 0 ? String(detected) : "—",
      done: Boolean(counts),
    },
    {
      label: "Roadmaps lidos",
      value: counts ? `${counts.roadmaps}/${counts.clients}` : "—",
      done: Boolean(counts),
    },
    {
      label: "Mensagens escritas",
      value: counts ? `${counts.ready}/${counts.clients}` : "—",
      done: Boolean(counts) && counts!.ready + counts!.failed === counts!.clients,
    },
  ];

  return (
    <div className="animate-fade-up mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <ol className="grid grid-cols-2 divide-y divide-white/[0.06] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {stages.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                s.done
                  ? "bg-[color:var(--brand-purple)] shadow-[0_0_10px_2px_rgba(120,61,245,0.55)]"
                  : planning && i <= 1
                    ? "animate-pulse bg-white/40"
                    : "bg-white/15"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="readout block text-white/35">{s.label}</span>
              <span
                className={`tabular text-[15px] font-semibold tracking-tight transition ${
                  s.done ? "text-white" : "text-white/30"
                }`}
              >
                {s.value}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReportCard({
  card,
  index,
  onDraft,
  onRegenerate,
}: {
  card: Card;
  index: number;
  onDraft: (v: string) => void;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const { plan } = card;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  const edited = card.draft !== card.message && card.message !== "";

  return (
    <article
      className="animate-fade-up overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.025]"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {/* Cabeçalho: quem é, em que semana do roadmap está, em que língua sai */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-white/[0.07] px-4 py-3">
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-tight text-white">
          {plan.title}
        </h3>
        {plan.lang === "en" && (
          <span className="readout rounded border border-white/12 px-1.5 py-0.5 text-white/45">
            EN
          </span>
        )}
        {plan.roadmap && (
          <span className="tabular text-[11px] text-white/40">
            roadmap S{plan.roadmap.currentWeek}
            <ArrowRight className="mx-1 inline h-2.5 w-2.5 -translate-y-px" />
            S{plan.roadmap.nextWeek}
          </span>
        )}
        {plan.slug && (
          <Link
            href={`/seo/${plan.slug}/roadmap`}
            className="rounded-lg border border-white/10 px-2 py-0.5 text-[11px] text-white/55 transition hover:border-white/30 hover:text-white"
          >
            Roadmap
          </Link>
        )}
      </header>

      {plan.warnings.length > 0 && (
        <div className="space-y-1 border-b border-amber-400/15 bg-amber-500/[0.06] px-4 py-2.5">
          {plan.warnings.map((w, i) => (
            <p
              key={i}
              className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-amber-100/90"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      {/* O que o cliente vai ver */}
      <div className="px-4 py-4">
        {card.status === "ready" ? (
          editing ? (
            <textarea
              value={card.draft}
              onChange={(e) => onDraft(e.target.value)}
              rows={18}
              aria-label={`Mensagem para ${plan.title}`}
              className="w-full resize-y rounded-xl border border-[color:var(--brand-purple)]/40 bg-black/40 px-3.5 py-3 text-[13px] leading-[1.55] text-white/90 outline-none focus:border-[color:var(--brand-purple)]"
            />
          ) : (
            <WhatsAppBubble text={card.draft} />
          )
        ) : card.status === "error" ? (
          <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.07] px-4 py-5 text-[12.5px] leading-relaxed text-rose-100">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{card.error}</span>
            </p>
            <button
              type="button"
              onClick={onRegenerate}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300/30 px-3 py-1.5 text-[12px] font-medium text-rose-100 transition hover:bg-rose-500/15"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar outra vez
            </button>
          </div>
        ) : (
          <WritingSkeleton writing={card.status === "writing"} />
        )}
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">
        <button
          type="button"
          disabled={card.status !== "ready" || !card.draft}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(card.draft);
              setCopied(true);
            } catch {
              /* a bolha continua selecionável */
            }
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition disabled:opacity-35 ${
            copied
              ? "bg-[#25D366] text-[#07130f]"
              : "bg-[#075E54] text-white hover:bg-[#0a7a6c]"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copiar mensagem
            </>
          )}
        </button>

        <button
          type="button"
          disabled={card.status !== "ready"}
          onClick={() => setEditing((e) => !e)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12px] text-white/65 transition hover:border-white/30 hover:text-white disabled:opacity-35"
        >
          <Pencil className="h-3.5 w-3.5" />
          {editing ? "Pré-visualizar" : "Editar"}
        </button>

        {edited && (
          <button
            type="button"
            onClick={() => onDraft(card.message)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] text-white/45 transition hover:text-white"
            title="Voltar à mensagem que a app escreveu"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Repor
          </button>
        )}

        <button
          type="button"
          disabled={card.status === "writing"}
          onClick={onRegenerate}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] text-white/45 transition hover:text-white disabled:opacity-35"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${card.status === "writing" ? "animate-spin" : ""}`}
          />
          Regenerar
        </button>

        <button
          type="button"
          onClick={() => setShowSource((s) => !s)}
          className="ml-auto text-[11.5px] text-white/35 underline-offset-4 transition hover:text-white/70 hover:underline"
        >
          {showSource ? "Esconder origem" : "De onde veio"}
        </button>
      </div>

      {showSource && <SourcePanel plan={plan} />}
    </article>
  );
}

/** A mensagem tal como o cliente a recebe. É a prévia honesta: o que está
 *  nesta bolha é byte a byte o que o botão «Copiar» põe na área de
 *  transferência. */
function WhatsAppBubble({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background:
          "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.035), transparent 55%), #0B141A",
      }}
    >
      <div className="flex justify-end">
        <div
          className="relative max-w-[92%] rounded-xl rounded-tr-sm px-3 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
          style={{ background: "#005C4B" }}
        >
          <p
            className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.48]"
            style={{ color: "#E9EDEF" }}
          >
            {text}
          </p>
          <span className="mt-1 flex items-center justify-end gap-1">
            <span className="tabular text-[10.5px]" style={{ color: "#8696A0" }}>
              agora
            </span>
            <CheckCheck className="h-3 w-3" style={{ color: "#53BDEB" }} />
          </span>
        </div>
      </div>
    </div>
  );
}

function WritingSkeleton({ writing }: { writing: boolean }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: "#0B141A" }}
      aria-live="polite"
    >
      <div className="flex justify-end">
        <div
          className="w-[80%] rounded-xl rounded-tr-sm px-3 py-3"
          style={{ background: "#005C4B" }}
        >
          <span className="sr-only">
            {writing ? "A escrever a mensagem" : "Na fila"}
          </span>
          {[92, 74, 84, 62].map((w, i) => (
            <span
              key={i}
              aria-hidden
              className={`mb-2 block h-2.5 rounded-full bg-white/15 ${writing ? "animate-pulse" : ""}`}
              style={{ width: `${w}%`, animationDelay: `${i * 140}ms` }}
            />
          ))}
          <span className="readout mt-1 block text-white/40">
            {writing ? "A escrever…" : "Na fila"}
          </span>
        </div>
      </div>
    </div>
  );
}

function SourcePanel({ plan }: { plan: WeeklyPlanClient }) {
  return (
    <div className="grid gap-4 border-t border-white/[0.06] bg-black/25 px-4 py-3.5 sm:grid-cols-2">
      <div>
        <p className="readout text-white/35">
          Dos daily updates · {plan.items.length}
        </p>
        <ul className="mt-2 space-y-1.5">
          {plan.items.map((s, i) => (
            <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed">
              <span className="shrink-0 text-white/25">{s.day}</span>
              <span className="text-white/65">{s.text}</span>
            </li>
          ))}
        </ul>
        {plan.rawNames.length > 1 && (
          <p className="mt-2.5 text-[11px] text-white/35">
            Escrito como {plan.rawNames.map((n) => `«${n}»`).join(", ")} — juntei
            tudo neste cliente.
          </p>
        )}
      </div>
      <div>
        <p className="readout text-white/35">
          Do roadmap · semana {plan.roadmap?.nextWeek ?? "—"}
        </p>
        {plan.roadmap && plan.roadmap.tasks.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {plan.roadmap.tasks.map((t, i) => (
              <li key={i} className="text-[11.5px] leading-relaxed text-white/65">
                • {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-amber-200/70">
            Nada programado.
            {plan.slug && (
              <Link
                href={`/seo/${plan.slug}/roadmap`}
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                Abrir roadmap
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
