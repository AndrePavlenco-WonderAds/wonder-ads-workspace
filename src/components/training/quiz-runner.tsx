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
//
// MODO INVIGILADO (`proctor`). Quando o exame tem cronómetro, este componente
// ganha mais três responsabilidades — e nenhuma delas decide seja o que for,
// porque o relógio que conta é o do servidor:
//   · mostra o tempo que falta, calculado sobre o `deadlineAt` do servidor e
//     corrigido pelo desvio do relógio local (mudar a hora do sistema não dá
//     um minuto a ninguém);
//   · grava a folha periodicamente, para que "acabar o tempo fica como está o
//     progresso" tenha alguma coisa concreta para recolher;
//   · entrega sozinho quando o tempo chega a zero.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  TimerOff,
  XCircle,
} from "lucide-react";
import type { PublicQuestion, SubmittedAnswer } from "@/lib/training/grading";

/** Tudo o que o modo invigilado precisa de saber. Ausente = quiz normal. */
export type ProctorConfig = {
  /** Instante (ms, relógio do SERVIDOR) em que a folha é recolhida. */
  deadlineAt: number;
  /** `serverNow - clientNow` no momento do arranque. Somado ao relógio local
   *  dá a hora do servidor sem pedir nada a mais. */
  clockOffsetMs: number;
  /** Onde gravar o snapshot da folha. */
  progressUrl: string;
  /** O que já estava gravado — quem recarrega a página não recomeça em branco. */
  initialAnswers?: SubmittedAnswer[];
};

/** De quanto em quanto tempo a folha é gravada no servidor. */
const AUTOSAVE_MS = 10_000;

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
  retryHref,
  /** Presente = exame com cronómetro. Ver `ProctorConfig`. */
  proctor,
  /** Chamado quando a folha sai da mesa — entregue ou recolhida ao apito.
   *  É o sinal para a consola desmontar o modo de bloqueio do ecrã. */
  onFinished,
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
  proctor?: ProctorConfig | null;
  onFinished?: () => void;
  /** Para onde vai o botão de nova tentativa num exame invigilado. Uma nova
   *  tentativa é uma sessão nova, com cronómetro novo — por isso passa
   *  obrigatoriamente pela página do exame, e não por um `setState` aqui. */
  retryHref?: string;
}) {
  const router = useRouter();
  const isExam = variant === "exam";
  const noun = isExam ? "exame" : "quiz";
  const endpoint = submitUrl ?? `/api/formacao/quiz/${quizId}/submit`;
  const startedAt = useRef(Date.now());

  // O que já estava gravado no servidor, reconstruído no formato do ecrã.
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    const seed: Record<string, string[]> = {};
    for (const a of proctor?.initialAnswers ?? []) {
      if (a.optionIds?.length) seed[a.questionId] = [...a.optionIds];
    }
    return seed;
  });
  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const a of proctor?.initialAnswers ?? []) {
      if (a.text) seed[a.questionId] = a.text;
    }
    return seed;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  /** O tempo acabou sem entrega possível — a folha foi recolhida como estava. */
  const [timeUp, setTimeUp] = useState(false);
  /** Quantas vezes a pessoa saiu do separador. Não bloqueia; fica no registo. */
  const [awayCount, setAwayCount] = useState(0);
  /** Relógio local, só para redesenhar o contador de segundo a segundo. */
  const [tick, setTick] = useState(() => Date.now());

  const msLeft = proctor
    ? proctor.deadlineAt - (tick + proctor.clockOffsetMs)
    : null;
  const isProctored = Boolean(proctor);
  const locked = isProctored && (timeUp || Boolean(result));

  // `proctor` e `onFinished` chegam como literais criados a cada render do
  // componente pai. Se os efeitos dependessem deles diretamente, o intervalo
  // de gravação era destruído e recriado a cada tecla — e o `cleanup` gravava
  // a folha de cada vez. Fica tudo em refs; os efeitos dependem só de valores
  // estáveis.
  const proctorRef = useRef(proctor);
  proctorRef.current = proctor;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

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

  /** A folha, no formato que o servidor lê. */
  const sheet = useCallback(
    (): SubmittedAnswer[] =>
      questions.map((q) => ({
        questionId: q.id,
        optionIds: answers[q.id] ?? [],
        text: texts[q.id] ?? null,
      })),
    [questions, answers, texts],
  );

  function toggle(q: PublicQuestion, optionId: string) {
    if (result || locked) return;
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

  const submit = useCallback(
    async function submit() {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startedAt: startedAt.current,
            answers: sheet(),
          }),
        });
        const data = (await res.json()) as Partial<Result> & {
          error?: string;
          expired?: boolean;
        };
        if (!res.ok) {
          // A folha já tinha sido recolhida. Não é um erro a corrigir — é o
          // resultado, e o que se mostra a seguir vem do servidor.
          if (data.expired) {
            setTimeUp(true);
            onFinishedRef.current?.();
            router.refresh();
            return;
          }
          setError(data.error ?? `Não foi possível submeter o ${noun}.`);
          return;
        }
        setResult(data as Result);
        onFinishedRef.current?.();
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.refresh();
      } catch {
        setError("Falha de rede — tenta outra vez.");
      } finally {
        setSubmitting(false);
      }
    },
    [endpoint, noun, router, sheet],
  );

  // ---- Invigilação ------------------------------------------------------
  // Um tique por segundo, só para o contador andar. Nada aqui decide nada: a
  // decisão é sempre do `deadlineAt` que o servidor carimbou.
  useEffect(() => {
    if (!isProctored || locked) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isProctored, locked]);

  // Entrega automática ao apito. Tenta submeter na mesma — se chegar dentro da
  // folga do servidor conta como entrega; se não, o servidor responde
  // `expired` e a folha é a que estava gravada.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (!isProctored || locked || msLeft === null || msLeft > 0) return;
    if (autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submit();
  }, [isProctored, locked, msLeft, submit]);

  // Grava a folha de dez em dez segundos. É o que "fica como está o progresso"
  // significa na prática — sem isto, quem fecha o portátil aos 55 minutos
  // levava zero, que é o resultado de um bug e não o resultado do exame.
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const awayRef = useRef(0);
  awayRef.current = awayCount;
  const saveSheet = useCallback(async () => {
    const config = proctorRef.current;
    if (!config) return;
    try {
      const res = await fetch(config.progressUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: sheetRef.current(),
          focusLossCount: awayRef.current,
        }),
      });
      // A resposta do servidor manda sobre o relógio local. Se a sessão já lá
      // está fechada — porque o prazo passou, ou porque foi entregue noutro
      // separador — não vale a pena continuar a escrever nem a fingir que o
      // exame decorre.
      if (res.status === 409) {
        setTimeUp(true);
        onFinishedRef.current?.();
        return;
      }
      const data = (await res.json()) as { expired?: boolean };
      if (data.expired) {
        setTimeUp(true);
        onFinishedRef.current?.();
      }
    } catch {
      /* A rede pode falhar; o próximo ciclo volta a tentar. */
    }
  }, []);

  useEffect(() => {
    if (!isProctored || locked) return;
    const id = setInterval(() => void saveSheet(), AUTOSAVE_MS);
    return () => {
      clearInterval(id);
      // Última gravação ao sair do ecrã — inclui fechar o separador.
      void saveSheet();
    };
  }, [isProctored, locked, saveSheet]);

  // Sair não pausa nada, mas também não é para acontecer por engano: o browser
  // pergunta antes de fechar, e cada ida a outro separador fica contada.
  useEffect(() => {
    if (!isProctored || locked) return;
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    function onVisibility() {
      if (document.visibilityState !== "hidden") return;
      setAwayCount((n) => n + 1);
      // Grava JÁ. O Chrome estrangula os temporizadores de um separador em
      // segundo plano (chegam a correr uma vez por minuto), por isso confiar
      // só no intervalo deixava um buraco de um minuto exatamente no momento
      // em que a pessoa se levanta e o portátil adormece. Este é o instante
      // em que o snapshot mais interessa.
      awayRef.current += 1;
      void saveSheet();
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isProctored, locked, saveSheet]);

  function retry() {
    setResult(null);
    setAnswers({});
    setTexts({});
    setError(null);
    startedAt.current = Date.now();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Tempo esgotado ----
  // A folha foi recolhida pelo invigilador. Não há aqui nada para clicar a
  // não ser sair: o resultado desta tentativa está na Formação, corrigido
  // sobre o que estava respondido no último minuto.
  if (timeUp && !result) {
    return (
      <div className="rounded-2xl border border-rose-400/35 bg-rose-500/[0.08] p-7 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-200">
          <TimerOff className="h-7 w-7" />
        </span>
        <p className="mt-4 text-lg font-semibold text-white">
          Tempo esgotado
        </p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-rose-100/75">
          O cronómetro chegou a zero e a folha foi recolhida como estava. Vale
          o que já lá estava respondido — o resto conta como não respondido.
          Esta tentativa está fechada e não se reabre.
        </p>
        <Link
          href={trackHref}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-medium text-white/80 transition hover:border-white/35 hover:text-white"
        >
          {backLabel}
        </Link>
      </div>
    );
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
              ) : proctor ? (
                // Num exame invigilado a tentativa seguinte é uma sessão nova,
                // com cronómetro novo. Volta-se à folha de rosto do exame e
                // carrega-se outra vez em "Começar" — de olhos abertos.
                !blocked && (
                  <Link
                    href={retryHref ?? trackHref}
                    className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Nova tentativa
                  </Link>
                )
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
  // Num exame invigilado a entrega nunca está desativada: entregar com
  // perguntas por responder é uma escolha legítima (e às vezes a única, com o
  // relógio a andar). O que a barra faz é dizer o preço dessa escolha.
  const canSubmit = proctor ? !submitting : allAnswered && !submitting;
  const urgent = msLeft !== null && msLeft <= 5 * 60_000;
  const critical = msLeft !== null && msLeft <= 60_000;

  return (
    <div className="space-y-5">
      <div
        className={`sticky z-20 rounded-xl border px-4 py-3 backdrop-blur-md ${
          proctor ? "top-2" : "top-16"
        } ${
          critical
            ? "border-rose-400/50 bg-rose-950/70"
            : urgent
              ? "border-amber-400/40 bg-amber-950/50"
              : "border-white/10 bg-[color:var(--background)]/90"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {msLeft !== null && (
            <span
              className={`tabular inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[19px] font-bold leading-none tracking-tight ${
                critical
                  ? "animate-pulse bg-rose-500/20 text-rose-100"
                  : urgent
                    ? "bg-amber-500/15 text-amber-100"
                    : "bg-white/[0.06] text-white"
              }`}
              aria-live="off"
              title="Tempo que falta — carimbado pelo servidor"
            >
              {formatClock(msLeft)}
            </span>
          )}
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
            onClick={() => {
              if (proctor && !allAnswered) {
                const missing = questions.length - answeredCount;
                const ok = window.confirm(
                  `Faltam ${missing} pergunta(s) por responder. Entregar assim conta como erradas. Entregar mesmo?`,
                );
                if (!ok) return;
              }
              void submit();
            }}
            disabled={!canSubmit}
            className="brand-gradient-bg inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {proctor ? "Entregar" : "Submeter"}
          </button>
        </div>
        {proctor && awayCount > 0 && (
          <p className="mt-2 text-[11px] font-medium text-amber-200/80">
            Saíste do exame {awayCount}{" "}
            {awayCount === 1 ? "vez" : "vezes"} — fica registado, e o
            cronómetro nunca parou.
          </p>
        )}
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
                    disabled={locked}
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
            ? `Tudo respondido. Podes ${proctor ? "entregar" : "submeter"}.`
            : `Faltam ${questions.length - answeredCount} pergunta(s).`}
        </p>
        <button
          type="button"
          onClick={() => {
            if (proctor && !allAnswered) {
              const missing = questions.length - answeredCount;
              const ok = window.confirm(
                `Faltam ${missing} pergunta(s) por responder. Entregar assim conta como erradas. Entregar mesmo?`,
              );
              if (!ok) return;
            }
            void submit();
          }}
          disabled={!canSubmit}
          className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {proctor ? `Entregar ${noun}` : `Submeter ${noun}`}
        </button>
      </div>
    </div>
  );
}
