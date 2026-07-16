"use client";

// Client-facing SEO satisfaction survey, in QUIZ mode: one section per
// step, a ruler progress bar, and a final thank-you screen. Lives on the
// public /[slug]/survey page (no app chrome, no auth). Posts to
// /api/nps/[slug]/submit.
//
// v2: four question kinds — 0–10 scale, single-choice, multi-select and
// open text — rendered from the NPS_SECTIONS catalogue.

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Star } from "lucide-react";
import {
  NPS_SECTIONS,
  isScale10,
  isSingle,
  isMulti,
  isOpen,
  type NpsQuestion,
  type NpsSingleQuestion,
  type NpsMultiQuestion,
  type NpsOpenQuestion,
} from "@/lib/nps-questions";
import type { PublicLang } from "@/lib/public-i18n";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

/** Wonder Ads' Google Business review link. Shown as a CTA on the final
 *  (testimonial) section so a happy client can post a public review. */
const GOOGLE_REVIEW_URL = "https://g.page/r/CSxgxSWM0p4VEAE/review";

const COPY = {
  pt: {
    progress: (a: number, b: number) => `${a} de ${b} respondidas`,
    sectionOf: (a: number, b: number) => `Secção ${a} de ${b}`,
    back: "Anterior",
    next: "Continuar",
    submit: "Enviar avaliação",
    sending: "A enviar…",
    missing: (n: number) => `Falta${n > 1 ? "m" : ""} ${n} nesta secção`,
    maxReached: (n: number) => `Máximo de ${n} opções`,
    identLabel: (company: string) =>
      `Quem está a responder por ${company}? (opcional)`,
    identPlaceholder: "O seu nome",
    googleReviewLead: "Ajuda ainda mais quem procura por nós:",
    googleReview: "Deixar review no Google",
    doneMark: "— Avaliação registada —",
    doneTitle: "Obrigado pelo seu tempo.",
    doneBody:
      "A sua avaliação foi registada. Este retorno ajuda-nos a manter o rigor na estratégia de SEO e no acompanhamento.",
    errorRetry: "Não foi possível enviar. Tente novamente.",
    optional: "opcional",
  },
  en: {
    progress: (a: number, b: number) => `${a} of ${b} answered`,
    sectionOf: (a: number, b: number) => `Section ${a} of ${b}`,
    back: "Back",
    next: "Continue",
    submit: "Submit evaluation",
    sending: "Sending…",
    missing: (n: number) => `${n} left in this section`,
    maxReached: (n: number) => `Max ${n} options`,
    identLabel: (company: string) => `Who's answering for ${company}? (optional)`,
    identPlaceholder: "Your name",
    googleReviewLead: "Help even more people find us:",
    googleReview: "Leave a Google review",
    doneMark: "— Evaluation recorded —",
    doneTitle: "Thank you for your time.",
    doneBody:
      "Your evaluation has been recorded. This feedback helps us keep our SEO strategy and follow-up sharp.",
    errorRetry: "Couldn't submit. Please try again.",
    optional: "optional",
  },
} as const;

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function Scale10({
  value,
  onChange,
  lowCap,
  highCap,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  lowCap: string;
  highCap: string;
}) {
  const ticks = Array.from({ length: 11 }, (_, i) => i);
  return (
    <div>
      <div className="grid grid-cols-11 gap-1">
        {ticks.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={selected}
              aria-label={String(n)}
              className="group flex items-center justify-center rounded-md py-1 outline-none transition focus-visible:ring-2 focus-visible:ring-[#783DF5]/50"
            >
              <span
                className="flex h-8 w-full items-center justify-center rounded-lg border text-[12px] font-semibold transition sm:h-9"
                style={{
                  borderColor: selected ? "transparent" : "rgba(0,0,0,0.16)",
                  background: selected ? BRAND_GRADIENT : "#ffffff",
                  color: selected ? "#fff" : "rgba(0,0,0,0.5)",
                  transform: selected ? "scale(1.04)" : "scale(1)",
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

function OptionRow({
  on,
  onClick,
  disabled,
  badge,
  square,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
  square: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      disabled={disabled && !on}
      className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        borderColor: on ? "transparent" : "rgba(0,0,0,0.12)",
        background: on ? "rgba(120,61,245,0.08)" : "#fff",
        boxShadow: on ? "inset 0 0 0 1.5px #783DF5" : "none",
      }}
    >
      {badge ? (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold transition"
          style={{
            background: on ? BRAND_GRADIENT : "rgba(0,0,0,0.06)",
            color: on ? "#fff" : "rgba(0,0,0,0.5)",
          }}
        >
          {badge}
        </span>
      ) : (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center border transition ${
            square ? "rounded-[6px]" : "rounded-full"
          }`}
          style={{
            borderColor: on ? "transparent" : "rgba(0,0,0,0.25)",
            background: on ? BRAND_GRADIENT : "transparent",
          }}
        >
          {on &&
            (square ? (
              <Check className="h-3.5 w-3.5 text-white" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-white" />
            ))}
        </span>
      )}
      <span className={on ? "text-black/85" : "text-black/70"}>{children}</span>
    </button>
  );
}

function SingleChoice({
  q,
  lang,
  value,
  onPick,
}: {
  q: NpsSingleQuestion;
  lang: PublicLang;
  value: string | undefined;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {q.options.map((o, i) => (
        <OptionRow
          key={o.value}
          on={value === o.value}
          onClick={() => onPick(o.value)}
          square={false}
          badge={q.lettered ? LETTERS[i] : undefined}
        >
          {o.label[lang]}
        </OptionRow>
      ))}
    </div>
  );
}

function MultiChoice({
  q,
  lang,
  selected,
  onToggle,
  maxNote,
}: {
  q: NpsMultiQuestion;
  lang: PublicLang;
  selected: string[];
  onToggle: (value: string) => void;
  maxNote?: string;
}) {
  const atMax = q.max !== undefined && selected.length >= q.max;
  return (
    <div>
      {q.hint && <p className="mb-2.5 text-[12px] text-black/45">{q.hint[lang]}</p>}
      <div className="flex flex-col gap-2">
        {q.options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <OptionRow
              key={o.value}
              on={on}
              onClick={() => onToggle(o.value)}
              disabled={atMax}
              square
            >
              {o.label[lang]}
            </OptionRow>
          );
        })}
      </div>
      {atMax && maxNote && (
        <p className="mt-2 text-[11px] font-medium text-[#783DF5]">{maxNote}</p>
      )}
    </div>
  );
}

function OpenText({
  q,
  lang,
  value,
  onChange,
  optionalWord,
}: {
  q: NpsOpenQuestion;
  lang: PublicLang;
  value: string;
  onChange: (v: string) => void;
  optionalWord: string;
}) {
  return (
    <div>
      {q.hint && (
        <p className="mb-2.5 text-[12px] leading-relaxed text-black/45">
          {q.hint[lang]}
        </p>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.placeholder?.[lang]}
        className="min-h-[96px] w-full resize-y rounded-lg border border-black/12 bg-[#f8f7f2] px-3.5 py-3 text-sm text-black/80 outline-none transition focus:border-[#783DF5]/50 focus:ring-2 focus:ring-[#783DF5]/15"
      />
      {!q.required && (
        <p className="mt-1 text-[11px] text-black/35">{optionalWord}</p>
      )}
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
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [identification, setIdentification] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  const isRequired = (q: NpsQuestion): boolean =>
    isScale10(q) ||
    (isSingle(q) && (q.required ?? true)) ||
    (isOpen(q) && Boolean(q.required));

  const isAnswered = (q: NpsQuestion): boolean => {
    if (isScale10(q)) return answers[q.name] !== undefined;
    if (isSingle(q)) return (choices[q.name]?.length ?? 0) > 0;
    if (isOpen(q)) return (texts[q.name]?.trim() ?? "") !== "";
    return true; // multi is always optional
  };

  const requiredQs = useMemo(
    () => sections.flatMap((s) => s.questions).filter(isRequired),
    [sections],
  );
  const answeredCount = requiredQs.filter(isAnswered).length;
  const totalRequired = requiredQs.length;

  const section = sections[step];
  const isLast = step === total - 1;
  const missingInStep = section.questions.filter(
    (q) => isRequired(q) && !isAnswered(q),
  ).length;

  function setAnswer(name: string, v: number) {
    setAnswers((prev) => ({ ...prev, [name]: v }));
  }
  function pickSingle(name: string, value: string) {
    setChoices((prev) => ({ ...prev, [name]: [value] }));
  }
  function toggleMulti(name: string, value: string, max?: number) {
    setChoices((prev) => {
      const cur = prev[name] ?? [];
      if (cur.includes(value)) {
        return { ...prev, [name]: cur.filter((v) => v !== value) };
      }
      if (max !== undefined && cur.length >= max) return prev;
      return { ...prev, [name]: [...cur, value] };
    });
  }
  function setText(name: string, v: string) {
    setTexts((prev) => ({ ...prev, [name]: v }));
  }

  async function submit() {
    setState("sending");
    try {
      const res = await fetch(`/api/nps/${slug}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers,
          choices,
          texts,
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

  const pct = totalRequired
    ? Math.round((answeredCount / totalRequired) * 100)
    : 0;

  return (
    <div>
      {/* Ruler progress */}
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[10px] font-medium uppercase tracking-[0.14em]">
          {sections.map((s, i) => {
            const done = s.questions.every((q) => !isRequired(q) || isAnswered(q));
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
              {isScale10(q) && (
                <Scale10
                  value={answers[q.name]}
                  onChange={(v) => setAnswer(q.name, v)}
                  lowCap={q.capLow[lang]}
                  highCap={q.capHigh[lang]}
                />
              )}
              {isSingle(q) && (
                <SingleChoice
                  q={q}
                  lang={lang}
                  value={choices[q.name]?.[0]}
                  onPick={(v) => pickSingle(q.name, v)}
                />
              )}
              {isMulti(q) && (
                <MultiChoice
                  q={q}
                  lang={lang}
                  selected={choices[q.name] ?? []}
                  onToggle={(v) => toggleMulti(q.name, v, q.max)}
                  maxNote={q.max ? t.maxReached(q.max) : undefined}
                />
              )}
              {isOpen(q) && (
                <OpenText
                  q={q}
                  lang={lang}
                  value={texts[q.name] ?? ""}
                  onChange={(v) => setText(q.name, v)}
                  optionalWord={t.optional}
                />
              )}
            </div>
          ))}

          {/* Google review CTA — on the final (testimonial) section. */}
          {isLast && (
            <div className="rounded-xl border border-black/8 bg-[#f8f7f2] px-4 py-4">
              <p className="mb-3 text-[13px] text-black/55">
                {t.googleReviewLead}
              </p>
              <a
                href={GOOGLE_REVIEW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition hover:brightness-110"
                style={{ background: BRAND_GRADIENT }}
              >
                <Star className="h-4 w-4 fill-white" />
                {t.googleReview}
              </a>
            </div>
          )}

          {/* Who's answering — on the final section only. */}
          {isLast && (
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
            {t.progress(answeredCount, totalRequired)}
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
