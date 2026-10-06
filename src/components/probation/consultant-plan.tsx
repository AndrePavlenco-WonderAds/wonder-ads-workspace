"use client";

// A página do plano de probation do CONSULTOR — e a pré-visualização dela
// que a direção vê antes de carregar em «Enviar». Desenha só o publicado
// (published.ts): o documento enviado, os check-ins e as avaliações, com a
// confirmação de leitura de cada um.
//
// Em `mode="preview"` nada é clicável para confirmar: é a montra do que o
// consultor vai receber, com o item a enviar destacado.

import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  Check,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Scale,
} from "lucide-react";
import { ProbationDocument } from "./probation-document";
import { FitToWidth } from "./fit-to-width";
import { EvalCardView, ProbationTimeline, WeekCardView, dayLabel } from "./views";
import { firstName, formatISODate, periodDates } from "@/lib/probation/shared";
import { timelineFromPub, todayLisbonISO } from "@/lib/probation/progress";
import {
  ackStamp,
  docForDisplay,
  pendingAcks,
  type PubAck,
  type PublishedPlan,
  type SendItem,
} from "@/lib/probation/published";

type Tab = "documento" | "checkins" | "avaliacoes";

function tabOf(item: SendItem): Tab {
  if (item === "plan") return "documento";
  return item.startsWith("week:") ? "checkins" : "avaliacoes";
}

export function ConsultantPlan({
  pub: initialPub,
  today,
  mode = "live",
  focus,
}: {
  pub: PublishedPlan;
  today: string;
  mode?: "live" | "preview";
  /** O item a destacar (pré-visualização de um envio). */
  focus?: { periodIndex: number; item: SendItem };
}) {
  const [pub, setPub] = useState(initialPub);
  const periods = pub.periods;
  const latest = periods.at(-1)?.index ?? 0;
  const [periodIndex, setPeriodIndex] = useState(focus?.periodIndex ?? latest);
  const period = periods.find((p) => p.index === periodIndex) ?? periods.at(-1) ?? null;
  const [tab, setTab] = useState<Tab>(focus ? tabOf(focus.item) : "documento");
  const pending = useMemo(() => pendingAcks(pub), [pub]);
  const preview = mode === "preview";

  if (!period) return null;
  const { d30 } = periodDates({ startDate: period.startDate });
  const tl = timelineFromPub(pub, period.index);
  const dayNum = (() => {
    if (!period.startDate) return null;
    const [a, b] = [period.startDate, today].map((x) => {
      const [y, m, d] = x.split("-").map(Number);
      return Date.UTC(y, m - 1, d);
    });
    return Math.round((b - a) / 86_400_000);
  })();
  const weeks = [...period.weeks].sort((a, b) => b.view.n - a.view.n);
  const evals = [...period.evals].sort((a, b) => b.view.which - a.view.which);
  const isFocus = (item: SendItem) => focus && focus.periodIndex === period.index && focus.item === item;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "documento", label: "O plano", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "checkins", label: "Check-ins semanais", icon: <CalendarCheck2 className="h-3.5 w-3.5" />, count: weeks.length },
    { id: "avaliacoes", label: "Avaliações", icon: <Scale className="h-3.5 w-3.5" />, count: evals.length },
  ];

  return (
    <div className="animate-fade-up">
      {/* ------------------------------ herói ------------------------------ */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--brand-gradient)" }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="readout text-white/40">
              Plano de probation{periods.length > 1 ? ` · ${period.index + 1}.º período` : ""}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              <span className="brand-gradient-text">Olá, {firstName(pub.consultantName) || "consultor"}</span>
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/55">
              Este é o teu plano: o que é esperado, até quando, e o acompanhamento de cada semana. Quem te
              acompanha é <span className="font-semibold text-white/80">{pub.lead || "a direção"}</span>
              {pub.checkinDay ? (
                <>
                  , com check-in às <span className="font-semibold text-white/80">{pub.checkinDay}</span>
                </>
              ) : null}
              .
            </p>
          </div>
          {dayNum !== null && (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
              <p className="readout text-white/40">Hoje</p>
              <p className="text-2xl font-bold tabular-nums text-white">
                {dayNum < 0 ? "—" : dayNum > 30 ? "30" : dayNum}
                <span className="text-sm font-medium text-white/40"> / 30 dias</span>
              </p>
              <p className="text-[11px] text-white/40">Avaliação final {dayLabel(d30)}</p>
            </div>
          )}
        </div>

        <div className="relative mt-2">
          <ProbationTimeline startDate={tl.startDate} today={today} weeks={tl.weeks} evals={tl.evals} />
        </div>

        {periods.length > 1 && (
          <div className="relative mt-1 flex flex-wrap gap-2">
            {periods.map((p) => (
              <button
                key={p.index}
                type="button"
                onClick={() => setPeriodIndex(p.index)}
                className={`rounded-full border px-3 py-1 text-[12px] transition ${
                  p.index === period.index
                    ? "border-[#783DF5]/60 bg-[#783DF5]/15 text-white"
                    : "border-white/10 text-white/50 hover:text-white/80"
                }`}
              >
                {p.index + 1}.º período
              </button>
            ))}
          </div>
        )}
      </section>

      {/* -------------------------- por confirmar -------------------------- */}
      {pending.length > 0 && !preview && (
        <section className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] px-5 py-4">
          <p className="text-[13px] font-semibold text-amber-100">
            Tens {pending.length} {pending.length === 1 ? "coisa" : "coisas"} para ler e confirmar
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pending.map((p) => (
              <button
                key={`${p.periodIndex}-${p.item}`}
                type="button"
                onClick={() => {
                  setPeriodIndex(p.periodIndex);
                  setTab(tabOf(p.item));
                  requestAnimationFrame(() =>
                    document.getElementById(`pb-${p.periodIndex}-${p.item}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
                className="rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-[12px] font-medium text-amber-50 transition hover:bg-amber-500/20"
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------ separadores ------------------------------ */}
      <nav className="mt-6 flex flex-wrap gap-1.5 border-b border-white/[0.07]" aria-label="Secções do plano">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition ${
              tab === t.id ? "border-[#783DF5] text-white" : "border-transparent text-white/45 hover:text-white/80"
            }`}
          >
            {t.icon}
            {t.label}
            {typeof t.count === "number" && (
              <span className="rounded-full bg-white/10 px-1.5 text-[10.5px] tabular-nums text-white/60">{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "documento" &&
          (period.doc ? (
            <div id={`pb-${period.index}-plan`} className={isFocus("plan") ? "rounded-3xl ring-2 ring-[#783DF5]/70 ring-offset-4 ring-offset-[#07080d]" : ""}>
              <AckBox
                ack={period.doc.ack}
                sentAt={period.doc.sentAt}
                kind="plan"
                preview={preview}
                pubId={pub.id}
                periodIndex={period.index}
                item="plan"
                onDone={setPub}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] text-white/40">O documento como te foi enviado a {formatISODate(todayLisbonISO(new Date(period.doc.sentAt)))}.</p>
                {!preview && (
                  <a
                    href={`/api/probation/pdf?plano=${encodeURIComponent(pub.id)}&periodo=${period.index + 1}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] font-medium text-white/80 transition hover:border-white/25 hover:text-white"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descarregar PDF
                  </a>
                )}
              </div>
              <div className="mt-3">
                <FitToWidth width={860}>
                  <ProbationDocument model={docForDisplay(period.doc)} />
                </FitToWidth>
              </div>
            </div>
          ) : (
            <Empty text="O documento do plano ainda não te foi enviado." />
          ))}

        {tab === "checkins" &&
          (weeks.length ? (
            <div className="space-y-6">
              {weeks.map((w) => {
                const item = `week:${w.view.n}` as SendItem;
                return (
                  <div
                    key={w.view.n}
                    id={`pb-${period.index}-${item}`}
                    className={isFocus(item) ? "rounded-2xl ring-2 ring-[#783DF5]/70 ring-offset-4 ring-offset-[#07080d]" : ""}
                  >
                    <WeekCardView view={w.view} />
                    <div className="mt-2">
                      <AckBox
                        ack={w.ack}
                        sentAt={w.sentAt}
                        kind="week"
                        preview={preview}
                        pubId={pub.id}
                        periodIndex={period.index}
                        item={item}
                        onDone={setPub}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty text="Os check-ins semanais aparecem aqui depois de cada reunião." />
          ))}

        {tab === "avaliacoes" &&
          (evals.length ? (
            <div className="space-y-6">
              {evals.map((e) => {
                const item = `eval:${e.view.which}` as SendItem;
                return (
                  <div
                    key={e.view.which}
                    id={`pb-${period.index}-${item}`}
                    className={isFocus(item) ? "rounded-2xl ring-2 ring-[#783DF5]/70 ring-offset-4 ring-offset-[#07080d]" : ""}
                  >
                    <EvalCardView view={e.view} />
                    <div className="mt-2">
                      <AckBox
                        ack={e.ack}
                        sentAt={e.sentAt}
                        kind="eval"
                        preview={preview}
                        pubId={pub.id}
                        periodIndex={period.index}
                        item={item}
                        onDone={setPub}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty text="Os resultados das avaliações dos 15 e dos 30 dias aparecem aqui." />
          ))}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center">
      <ClipboardList className="mx-auto h-6 w-6 text-white/25" />
      <p className="mt-3 text-[13px] text-white/50">{text}</p>
    </div>
  );
}

const ACK_COPY: Record<"plan" | "week" | "eval", { cta: string; hint: string }> = {
  plan: {
    cta: "Li o plano e sei o que é esperado",
    hint: "Confirmar não é concordar com tudo: é dizer que leste e sabes o que é esperado e o que pode acontecer. Fica registado com a data, por baixo da tua assinatura.",
  },
  week: {
    cta: "Tomei conhecimento deste check-in",
    hint: "Se alguma coisa não bate certo com o que foi falado, escreve aqui — chega à direção.",
  },
  eval: {
    cta: "Tomei conhecimento desta avaliação",
    hint: "Fica registado que recebeste a decisão por escrito. Podes deixar um comentário.",
  },
};

function AckBox({
  ack,
  kind,
  preview,
  pubId,
  periodIndex,
  item,
  onDone,
}: {
  ack: PubAck | null;
  sentAt: number;
  kind: "plan" | "week" | "eval";
  preview: boolean;
  pubId: string;
  periodIndex: number;
  item: SendItem;
  onDone: (pub: PublishedPlan) => void;
}) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = ACK_COPY[kind];

  if (ack) {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] px-4 py-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
          <Check className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-emerald-100">{ackStamp(ack.at)}</p>
          {ack.comment && (
            <p className="mt-1 flex gap-1.5 text-[12.5px] text-white/60">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" />
              {ack.comment}
            </p>
          )}
        </div>
      </div>
    );
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/probation/confirmar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: pubId, period: periodIndex, item, comment }),
      });
      const data = (await res.json().catch(() => ({}))) as { pub?: PublishedPlan; error?: string };
      if (!res.ok || !data.pub) {
        setError(data.error ?? "Não foi possível confirmar.");
        setBusy(false);
        return;
      }
      onDone(data.pub);
    } catch {
      setError("Sem ligação — tenta outra vez.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#783DF5]/30 bg-[#783DF5]/[0.06] px-4 py-3.5">
      <p className="text-[12px] leading-relaxed text-white/55">{copy.hint}</p>
      <textarea
        value={comment}
        disabled={preview || busy}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentário (opcional)"
        className="mt-2.5 min-h-[56px] w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-[#783DF5]/60 focus:outline-none disabled:opacity-60"
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={preview || busy}
          onClick={() => void confirm()}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "var(--brand-gradient)" }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {copy.cta}
        </button>
        {preview && <span className="text-[11.5px] text-white/40">O consultor confirma aqui.</span>}
        {error && <span className="text-[12px] text-rose-300">{error}</span>}
      </div>
    </div>
  );
}
