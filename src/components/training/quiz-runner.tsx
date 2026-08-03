"use client";

// Quiz de um capítulo — e, no modo `exam`, também os exames de fase: lista
// completa de perguntas (mais simples e mais consistente com a app do que um
// wizard), barra de progresso de resposta, submissão e correção pergunta a
// pergunta.
//
// UM COMPONENTE PARA OS DOIS. O que muda entre um quiz e um exame não é a
// forma de responder — é o que está em jogo. Por isso o que o modo `exam`
// altera é só o vocabulário e o ecrã de resultado (que passa a dizer o que
// aquela nota DECIDE), e não a mecânica. Duas implementações da mesma lista
// de perguntas divergiriam ao primeiro ajuste.
//
// A correção NUNCA é calculada aqui — as opções chegam sem indicação de qual
// é a certa. O que se mostra depois de submeter vem inteiro da resposta do
// servidor.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  PartyPopper,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { PublicQuestion } from "@/lib/training/grading";

type CorrectionRow = {
  questionId: string;
  prompt: string;
  isCorrect: boolean;
  manualReview: boolean;
  chosenOptionIds: string[];
  correctOptionIds: string[];
  explanation: string | null;
  options: { id: string; text: string }[];
};

/** O que o resultado de um exame decide. Ausente nos quizzes de capítulo. */
export type ExamOutcome = "advance" | "effective" | "retry" | "blocked";

type Result = {
  score: number;
  passed: boolean;
  passingScore: number;
  attemptNumber: number;
  attemptsLeft: number | null;
  pendingReview: number;
  correction: CorrectionRow[];
  outcome?: ExamOutcome;
};

export function QuizRunner({
  quizId,
  questions,
  passingScore,
  attemptNumber,
  attemptsLeft,
  trackHref,
  nextHref,
  variant = "quiz",
  submitUrl,
  backLabel = "Voltar à sequência",
  /** Frase que o ecrã de resultado usa quando se passa (o que isto abre). */
  gateLine,
}: {
  quizId: string;
  questions: PublicQuestion[];
  passingScore: number;
  attemptNumber: number;
  /** null = tentativas ilimitadas. */
  attemptsLeft: number | null;
  trackHref: string;
  /** Para onde seguir depois de passar (próximo capítulo ou o módulo). */
  nextHref: string;
  variant?: "quiz" | "exam";
  /** Endpoint de submissão. Default: o dos quizzes de capítulo. */
  submitUrl?: string;
  backLabel?: string;
  gateLine?: string;
}) {
  const router = useRouter();
  const isExam = variant === "exam";
  const noun = isExam ? "exame" : "quiz";
  const endpoint = submitUrl ?? `/api/formacao/quiz/${quizId}/submit`;
  const startedAt = useRef(Date.now());
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const answeredCount = useMemo(
    () =>
      questions.filter((q) =>
        q.type === "open_text"
          ? (texts[q.id] ?? "").trim().length > 0
          : (answers[q.id] ?? []).length > 0,
      ).length,
    [questions, answers, texts],
  );
  const allAnswered = answeredCount === questions.length;

  function toggle(q: PublicQuestion, optionId: string) {
    if (result) return;
    setAnswers((prev) => {
      const current = prev[q.id] ?? [];
      if (q.type === "multi_select") {
        return {
          ...prev,
          [q.id]: current.includes(optionId)
            ? current.filter((x) => x !== optionId)
            : [...current, optionId],
        };
      }
      return { ...prev, [q.id]: [optionId] };
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: startedAt.current,
          answers: questions.map((q) => ({
            questionId: q.id,
            optionIds: answers[q.id] ?? [],
            text: texts[q.id] ?? null,
          })),
        }),
      });
      const data = (await res.json()) as Partial<Result> & { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Não foi possível submeter o ${noun}.`);
        return;
      }
      setResult(data as Result);
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch {
      setError("Falha de rede — tenta outra vez.");
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setResult(null);
    setAnswers({});
    setTexts({});
    setError(null);
    startedAt.current = Date.now();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Resultado ----
  if (result) {
    const wrong = result.correction.filter(
      (c) => !c.isCorrect && !c.manualReview,
    );
    const blocked = result.outcome === "blocked" || result.attemptsLeft === 0;
    const effective = result.outcome === "effective";
    // O que a nota decide, dito em uma linha. Nos quizzes não há decisão
    // nenhuma a comunicar — só o passo seguinte.
    const verdict = !isExam
      ? null
      : effective
        ? "Passaste o exame final. Estás efetivo."
        : result.passed
          ? (gateLine ?? "Passaste — a fase seguinte está aberta.")
          : blocked
            ? "Sem tentativas neste exame. A decisão passa para o C-Level — fala com o Andre, o Alex ou a Alice."
            : "Não chegou à nota mínima. Tens mais uma tentativa — relê a matéria antes de a gastares.";

    return (
      <div className="space-y-6">
        <div
          className={`relative overflow-hidden rounded-2xl border p-6 ${
            result.passed
              ? "border-emerald-400/30 bg-emerald-500/[0.07]"
              : blocked
                ? "border-rose-400/35 bg-rose-500/[0.08]"
                : "border-amber-400/30 bg-amber-500/[0.07]"
          }`}
        >
          {effective && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
              style={{ background: "var(--brand-gradient)" }}
            />
          )}
          <div className="relative flex flex-wrap items-center gap-4">
            <span
              className={`tabular flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold ${
                result.passed
                  ? "bg-emerald-500/15 text-emerald-300"
                  : blocked
                    ? "bg-rose-500/15 text-rose-300"
                    : "bg-amber-500/15 text-amber-200"
              }`}
            >
              {result.score}%
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-lg font-semibold text-white">
                {effective ? (
                  <>
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    Efetivo
                  </>
                ) : result.passed ? (
                  <>
                    <PartyPopper className="h-5 w-5 text-emerald-300" />
                    {isExam ? "Passaste o exame" : "Passaste o quiz"}
                  </>
                ) : blocked ? (
                  <>
                    <XCircle className="h-5 w-5 text-rose-300" />
                    Sem tentativas
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-300" />
                    Ainda não chegou
                  </>
                )}
              </p>
              {verdict && (
                <p className="mt-1 text-[13.5px] font-medium text-white/85">
                  {verdict}
                </p>
              )}
              <p className="tabular mt-1 text-[13px] text-white/60">
                Mínimo para passar: {result.passingScore}% · tentativa{" "}
                {result.attemptNumber}
                {result.attemptsLeft !== null &&
                  ` · ${result.attemptsLeft} tentativa${result.attemptsLeft === 1 ? "" : "s"} restante${result.attemptsLeft === 1 ? "" : "s"}`}
                {wrong.length > 0 &&
                  ` · ${wrong.length} resposta${wrong.length === 1 ? "" : "s"} errada${wrong.length === 1 ? "" : "s"}`}
              </p>
              {result.pendingReview > 0 && (
                <p className="mt-1 text-[12px] text-white/45">
                  {result.pendingReview} pergunta(s) de resposta aberta ficam
                  para leitura do C-Level e não contam para a nota.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {result.passed ? (
                <Link
                  href={nextHref}
                  className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={retry}
                  disabled={blocked}
                  className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Repetir {noun}
                </button>
              )}
              <Link
                href={trackHref}
                className="inline-flex items-center rounded-xl border border-white/12 px-4 py-2.5 text-[13px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
              >
                {backLabel}
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A9834F]">
            Correção
          </h2>
          {result.correction.map((c, i) => (
            <div
              key={c.questionId}
              className={`rounded-2xl border p-5 ${
                c.manualReview
                  ? "border-white/10 bg-white/[0.02]"
                  : c.isCorrect
                    ? "border-emerald-400/20 bg-emerald-500/[0.04]"
                    : "border-rose-400/25 bg-rose-500/[0.05]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  {c.manualReview ? (
                    <AlertTriangle className="h-4 w-4 text-white/40" />
                  ) : c.isCorrect ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-300" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-white/90">
                    {i + 1}. {c.prompt}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {c.options.map((o) => {
                      const chosen = c.chosenOptionIds.includes(o.id);
                      const correct = c.correctOptionIds.includes(o.id);
                      return (
                        <li
                          key={o.id}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] ${
                            correct
                              ? "bg-emerald-500/10 text-emerald-100/90"
                              : chosen
                                ? "bg-rose-500/10 text-rose-100/90"
                                : "text-white/45"
                          }`}
                        >
                          <span className="w-4 shrink-0 text-center">
                            {correct ? "✓" : chosen ? "✗" : "·"}
                          </span>
                          <span>{o.text}</span>
                          {chosen && (
                            <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-white/40">
                              a tua resposta
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {c.explanation && (
                    <p className="mt-3 border-l-2 border-[#783DF5]/40 pl-3 text-[12.5px] leading-relaxed text-white/60">
                      {c.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Por responder ----
  return (
    <div className="space-y-5">
      <div className="sticky top-16 z-20 rounded-xl border border-white/10 bg-[color:var(--background)]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="brand-gradient-bg h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${Math.round((answeredCount / questions.length) * 100)}%`,
              }}
            />
          </div>
          <span className="text-[11.5px] font-medium text-white/55">
            {answeredCount}/{questions.length} respondidas · mínimo{" "}
            {passingScore}%
            {attemptsLeft !== null && ` · ${attemptsLeft} tentativas restantes`}
            {attemptNumber > 1 && ` · tentativa ${attemptNumber}`}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!allAnswered || submitting}
            className="brand-gradient-bg inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submeter
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100/90">
          {error}
        </p>
      )}

      {questions.map((q, i) => {
        const chosen = answers[q.id] ?? [];
        return (
          <div
            key={q.id}
            className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-white/60">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium leading-relaxed text-white/90">
                  {q.prompt}
                </p>
                {q.type === "multi_select" && (
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-[#A9834F]">
                    Escolhe todas as que se aplicam
                  </p>
                )}

                {q.type === "open_text" ? (
                  <textarea
                    value={texts[q.id] ?? ""}
                    onChange={(e) =>
                      setTexts((p) => ({ ...p, [q.id]: e.target.value }))
                    }
                    rows={4}
                    placeholder="A tua resposta…"
                    className="mt-3 w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#783DF5]/60"
                  />
                ) : (
                  <ul className="mt-3 space-y-2">
                    {q.options.map((o) => {
                      const isChosen = chosen.includes(o.id);
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => toggle(q, o.id)}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[13px] transition ${
                              isChosen
                                ? "border-[#783DF5]/50 bg-[#783DF5]/12 text-white"
                                : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/25 hover:bg-white/[0.05]"
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[9px] font-bold ${
                                q.type === "multi_select"
                                  ? "rounded"
                                  : "rounded-full"
                              } ${
                                isChosen
                                  ? "border-transparent bg-[#783DF5] text-white"
                                  : "border-white/25"
                              }`}
                            >
                              {isChosen ? "✓" : ""}
                            </span>
                            {o.text}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <p className="text-[12.5px] text-white/50">
          {allAnswered
            ? "Tudo respondido. Podes submeter."
            : `Faltam ${questions.length - answeredCount} pergunta(s).`}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!allAnswered || submitting}
          className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Submeter {noun}
        </button>
      </div>
    </div>
  );
}
