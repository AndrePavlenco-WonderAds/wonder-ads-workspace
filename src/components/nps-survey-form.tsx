"use client";

// Client-facing SEO satisfaction survey, in QUIZ mode: one section per
// step, a ruler progress bar, and a final thank-you screen. Lives on the
// public /[slug]/survey page (no app chrome, no auth). Adapts the original
// standalone HTML form's editorial tick-scale into a stepped experience and
// posts to /api/nps/[slug]/submit.

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { NPS_SECTIONS, NPS_QUESTION_NAMES } from "@/lib/nps-questions";
import type { PublicLang } from "@/lib/public-i18n";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

const COPY = {
  pt: {
    progress: (a: number, b: number) => `${a} de ${b} respondidas`,
    sectionOf: (a: number, b: number) => `Secção ${a} de ${b}`,
    back: "Anterior",
    next: "Continuar",
    submit: "Enviar avaliação",
    sending: "A enviar…",
    missing: (n: number) => `Falta${n > 1 ? "m" : ""} ${n} nesta secção`,
    commentLabel:
      "O que destacaria no trabalho de SEO — o que correu bem e o que gostaria que fosse diferente? (opcional)",
    commentPlaceholder: "Escreva aqui a sua observação…",
    identLabel: (company: string) => `Quem está a responder por ${company}? (opcional)`,
    identPlaceholder: "O seu nome",
    doneMark: "— Avaliação registada —",
    doneTitle: "Obrigado pelo seu tempo.",
    doneBody:
      "A sua avaliação foi registada. Este retorno ajuda-nos a manter o rigor na estratégia de SEO e no acompanhamento.",
    errorRetry: "Não foi possível enviar. Tente novamente.",
  },
  en: {
    progress: (a: number, b: number) => `${a} of ${b} answered`,
    sectionOf: (a: number, b: number) => `Section ${a} of ${b}`,
    back: "Back",
    next: "Continue",
    submit: "Submit evaluation",
    sending: "Sending…",
    missing: (n: number) => `${n} left in this section`,
    commentLabel:
      "What stood out in the SEO work — what went well and what would you change? (optional)",
    commentPlaceholder: "Write your note here…",
    identLabel: (company: string) => `Who's answering for ${company}? (optional)`,
    identPlaceholder: "Your name",
    doneMark: "— Evaluation recorded —",
    doneTitle: "Thank you for your time.",
    doneBody:
      "Your evaluation has been recorded. This feedback helps us keep our SEO strategy and follow-up sharp.",
    errorRetry: "Couldn't submit. Please try again.",
  },
} as const;

type ScaleProps = {
  value: number | undefined;
  onChange: (v: number) => void;
  min: number;
  max: number;
  lowCap: string;
  highCap: string;
};

function Scale({ value, onChange, min, max, lowCap, highCap }: ScaleProps) {
  const ticks: number[] = [];
  for (let i = min; i <= max; i++) ticks.push(i);
  const isNps = max === 10;
  return (
    <div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${ticks.length}, minmax(0, 1fr))` }}
      >
        {ticks.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={selected}
              aria-label={String(n)}
              className="group flex flex-col items-center gap-2 rounded-md py-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-[#783DF5]/50"
            >
              <span
                className="flex items-center justify-center rounded-full border text-[11px] font-semibold transition"
                style={{
                  width: isNps ? 26 : 34,
                  height: isNps ? 26 : 34,
                  borderColor: selected ? "transparent" : "rgba(0,0,0,0.18)",
                  background: selected ? BRAND_GRADIENT : "#ffffff",
                  color: selected ? "#fff" : "rgba(0,0,0,0.45)",
                  transform: selected ? "scale(1.06)" : "scale(1)",
                  boxShadow: selected
                    ? "0 6px 16px -6px rgba(120,61,245,0.5)"
                    : "none",
                }}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-black/45">
        <span>{lowCap}</span>
        <span>{highCap}</span>
      </div>
    </div>
  );
}

export function NpsSurveyForm({
  slug,
  clientName,
  lang,
}: {
  slug: string;
  clientName: string;
  lang: PublicLang;
}) {
  const t = COPY[lang];
  const sections = NPS_SECTIONS;
  const total = sections.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [identification, setIdentification] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  const answeredCount = useMemo(
    () => NPS_QUESTION_NAMES.filter((n) => answers[n] !== undefined).length,
    [answers],
  );

  const section = sections[step];
  const isLast = step === total - 1;
  const missingInStep = section.questions.filter(
    (q) => answers[q.name] === undefined,
  ).length;

  function setAnswer(name: string, v: number) {
    setAnswers((prev) => ({ ...prev, [name]: v }));
  }

  async function submit() {
    setState("sending");
    try {
      const res = await fetch(`/api/nps/${slug}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers,
          comment: comment.trim() || null,
          identification: identification.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setState("error");
    }
  }

  function next() {
    if (missingInStep > 0) return;
    if (isLast) {
      submit();
      return;
    }
    setStep((s) => Math.min(total - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-black/8 bg-white px-6 py-16 text-center shadow-sm">
        <div
          className="text-sm font-semibold tracking-wide"
          style={{
            background: BRAND_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          {t.doneMark}
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-black/85">
          {t.doneTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-black/55">
          {t.doneBody}
        </p>
      </div>
    );
  }

  const pct = Math.round((answeredCount / NPS_QUESTION_NAMES.length) * 100);

  return (
    <div>
      {/* Ruler progress */}
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[10px] font-medium uppercase tracking-[0.14em]">
          {sections.map((s, i) => {
            const done = s.questions.every(
              (q) => answers[q.name] !== undefined,
            );
            const current = i === step;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(i)}
                className="transition"
                style={{
                  color: current
                    ? "#1B2430"
                    : done
                      ? "#6E7F6A"
                      : "rgba(0,0,0,0.32)",
                  fontWeight: current || done ? 600 : 500,
                }}
              >
                {s.title[lang]}
              </button>
            );
          })}
        </div>
        <div className="relative h-1 rounded-full bg-black/8">
          <div
            className="absolute left-0 top-0 h-1 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: BRAND_GRADIENT }}
          />
        </div>
      </div>

      {/* Section card */}
      <div className="rounded-2xl border border-black/8 bg-white px-6 py-7 shadow-sm sm:px-8">
        <div className="mb-6 flex items-baseline gap-2.5 border-b border-black/8 pb-4">
          <span className="font-mono text-[11px] tracking-widest text-[#783DF5]">
            {section.tag}
          </span>
          <span className="text-lg font-semibold text-black/85">
            {section.title[lang]}
          </span>
          <span className="ml-auto text-[11px] text-black/40">
            {t.sectionOf(step + 1, total)}
          </span>
        </div>

        <div className="space-y-7">
          {section.questions.map((q) => (
            <div key={q.name}>
              <div className="mb-3 text-[15px] font-medium leading-snug text-black/80">
                {q.q[lang]}
              </div>
              <Scale
                value={answers[q.name]}
                onChange={(v) => setAnswer(q.name, v)}
                min={q.scale === "nps" ? 0 : 1}
                max={q.scale === "nps" ? 10 : 5}
                lowCap={q.capLow[lang]}
                highCap={q.capHigh[lang]}
              />
            </div>
          ))}

          {/* Optional free-text on the final section. */}
          {isLast && (
            <>
              <div>
                <div className="mb-3 text-[15px] font-medium leading-snug text-black/80">
                  {t.commentLabel}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t.commentPlaceholder}
                  className="min-h-[88px] w-full resize-y rounded-lg border border-black/12 bg-[#f8f7f2] px-3.5 py-3 text-sm text-black/80 outline-none transition focus:border-[#783DF5]/50 focus:ring-2 focus:ring-[#783DF5]/15"
                />
              </div>
              <div>
                <div className="mb-2 text-[15px] font-medium leading-snug text-black/80">
                  {t.identLabel(clientName)}
                </div>
                <input
                  type="text"
                  value={identification}
                  onChange={(e) => setIdentification(e.target.value)}
                  placeholder={t.identPlaceholder}
                  className="w-full border-b border-black/15 bg-transparent px-1 py-2 text-[15px] text-black/80 outline-none transition focus:border-[#783DF5]"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {state === "error" && (
        <p className="mt-4 text-center text-sm text-rose-600">{t.errorRetry}</p>
      )}

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            setStep((s) => Math.max(0, s - 1));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-black/55 transition hover:bg-black/[0.04] hover:text-black/80 disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </button>

        <div className="flex items-center gap-4">
          <span className="hidden text-[11px] text-black/40 sm:inline">
            {t.progress(answeredCount, NPS_QUESTION_NAMES.length)}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={missingInStep > 0 || state === "sending"}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            style={{ background: BRAND_GRADIENT }}
          >
            {state === "sending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.sending}
              </>
            ) : missingInStep > 0 ? (
              t.missing(missingInStep)
            ) : isLast ? (
              <>
                <Check className="h-4 w-4" />
                {t.submit}
              </>
            ) : (
              <>
                {t.next}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
