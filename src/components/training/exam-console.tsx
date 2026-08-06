"use client";

// A consola de um exame de fase — a folha de rosto, a confirmação, e o ecrã
// fechado onde o exame acontece.
//
// DESENHO — UM EXAME COMEÇA COM UMA DECISÃO, NÃO COM UM CLIQUE DISTRAÍDO.
// Antes de o cronómetro arrancar, a pessoa lê as regras todas escritas em
// números (quanto tempo, quantas tentativas, o que acontece se sair) e tem de
// confirmar DUAS vezes: uma no botão, outra no diálogo. Isto não é fricção por
// fricção — é a diferença entre "abri sem querer e perdi a tentativa" e "sabia
// exatamente no que estava a entrar".
//
// Depois de começar, o exame TOMA O ECRÃ. A navegação do workspace desaparece,
// não porque um `overflow: hidden` impeça alguém de sair (nada no browser
// impede), mas porque o ecrã deixa de sugerir que sair é uma coisa normal a
// fazer. O que impede mesmo é o servidor: o prazo está carimbado lá, e voltar
// dá o tempo que sobrou, não o tempo que faltava quando se saiu.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  Lock,
  ShieldAlert,
  Timer,
  X,
} from "lucide-react";
import { QuizRunner } from "@/components/training/quiz-runner";
import type { PublicQuestion, SubmittedAnswer } from "@/lib/training/grading";

export type RunningSession = {
  startedAt: number;
  deadlineAt: number;
  attemptNumber: number;
  answers: SubmittedAnswer[];
  /** `Date.now()` no servidor no instante em que a página foi desenhada. */
  serverNow: number;
};

type Phase = "briefing" | "starting" | "running" | "finished";

export function ExamConsole({
  examId,
  examTitle,
  examLabel,
  gateLine,
  questions,
  passingScore,
  attemptNumber,
  attemptsLeft,
  maxAttempts,
  durationMinutes,
  initialSession,
}: {
  examId: string;
  examTitle: string;
  examLabel: string;
  gateLine: string;
  questions: PublicQuestion[];
  passingScore: number;
  attemptNumber: number;
  attemptsLeft: number | null;
  maxAttempts: number | null;
  durationMinutes: number;
  /** Sessão já a decorrer (a pessoa recarregou a página a meio do exame). */
  initialSession: RunningSession | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    initialSession ? "running" : "briefing",
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<RunningSession | null>(initialSession);
  /** `serverNow - clientNow`. Fixado uma vez, no arranque da sessão. */
  const [clockOffsetMs, setClockOffsetMs] = useState(() =>
    initialSession ? initialSession.serverNow - Date.now() : 0,
  );

  // O ecrã do exame vive num portal para o `body`, e só depois de montar.
  //
  // PORQUÊ O PORTAL: o `PageShell` tem `backdrop-blur`, e um ancestral com
  // filtro passa a ser o bloco que contém os filhos `position: fixed` — o
  // ecrã do exame ficava recortado dentro da coluna de conteúdo em vez de
  // cobrir o separador. O mesmo motivo do painel de notificações do header.
  //
  // PORQUÊ SÓ DEPOIS DE MONTAR: no servidor não há `document`, e quem recarrega
  // a página a meio de um exame já chega com sessão a decorrer.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Com o exame no ecrã, a página por baixo não faz scroll — a folha é a
  // única coisa que se mexe.
  useEffect(() => {
    if (!session || !mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [session, mounted]);

  const start = useCallback(async () => {
    setPhase("starting");
    setError(null);
    setConfirming(false);
    try {
      const res = await fetch(`/api/formacao/exame/${examId}/start`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        startedAt?: number;
        deadlineAt?: number;
        attemptNumber?: number;
        answers?: SubmittedAnswer[];
        serverNow?: number;
      };
      if (!res.ok || !data.deadlineAt || !data.serverNow) {
        setError(data.error ?? "Não foi possível abrir o exame.");
        setPhase("briefing");
        router.refresh();
        return;
      }
      setClockOffsetMs(data.serverNow - Date.now());
      setSession({
        startedAt: data.startedAt ?? data.serverNow,
        deadlineAt: data.deadlineAt,
        attemptNumber: data.attemptNumber ?? attemptNumber,
        answers: data.answers ?? [],
        serverNow: data.serverNow,
      });
      setPhase("running");
    } catch {
      setError("Falha de rede — o exame não chegou a abrir. Tenta outra vez.");
      setPhase("briefing");
    }
  }, [examId, attemptNumber, router]);

  // ---- A correr (e depois, o resultado, no mesmo ecrã) ----
  //
  // O ecrã só se desmonta quando a pessoa sai por um link. É deliberado: se o
  // exame voltasse à página normal no instante da entrega, o React
  // desmontava o `QuizRunner` e a correção — que é a parte que interessa ler —
  // desaparecia com ele.
  if (session && mounted && (phase === "running" || phase === "finished")) {
    const running = phase === "running";
    return createPortal(
      <div className="fixed inset-0 z-[90] overflow-y-auto bg-[color:var(--background)] px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <header
            className={`mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-4 py-2.5 ${
              running
                ? "border-[#C535C9]/30 bg-[#C535C9]/[0.07]"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
                running ? "text-[#f0a8ee]" : "text-white/45"
              }`}
            >
              <Lock className="h-3 w-3" />
              {running ? "Exame a decorrer" : "Exame terminado"}
            </span>
            <span className="truncate text-[12.5px] font-semibold text-white/85">
              {examTitle}
            </span>
            <span className="tabular ml-auto text-[11px] text-white/40">
              tentativa {session.attemptNumber}
              {maxAttempts !== null && `/${maxAttempts}`} · mínimo{" "}
              {passingScore}%
            </span>
          </header>

          <QuizRunner
            variant="exam"
            quizId={examId}
            submitUrl={`/api/formacao/exame/${examId}/submit`}
            questions={questions}
            passingScore={passingScore}
            attemptNumber={session.attemptNumber}
            attemptsLeft={attemptsLeft}
            trackHref="/formacao"
            nextHref="/formacao"
            retryHref={`/formacao/exame/${examId}`}
            backLabel="Voltar à Formação"
            gateLine={gateLine}
            onFinished={() => setPhase("finished")}
            proctor={{
              deadlineAt: session.deadlineAt,
              clockOffsetMs,
              progressUrl: `/api/formacao/exame/${examId}/progress`,
              initialAnswers: session.answers,
            }}
          />
        </div>
      </div>,
      document.body,
    );
  }

  // ---- Folha de rosto ----
  return (
    <div className="rounded-2xl border border-[#C535C9]/30 bg-[#C535C9]/[0.05] p-6 sm:p-7">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Timer className="h-4.5 w-4.5 text-[#f0a8ee]" />
        {durationMinutes} minutos, sem pausas
      </p>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/55">
        Isto é um exame invigilado. O cronómetro arranca no servidor no instante
        em que carregas em começar e não pára mais — nem quando fechas o
        separador, nem quando recarregas a página, nem quando desligas o
        portátil.
      </p>

      <ol className="mt-5 space-y-2.5">
        <Rule n={1}>
          Tens <strong className="text-white/90">{durationMinutes} minutos</strong>{" "}
          a contar do momento em que confirmares. Recarregar a página devolve o
          tempo que sobrou, nunca o tempo do início.
        </Rule>
        <Rule n={2}>
          <strong className="text-white/90">Sair não pausa nada.</strong> Podes
          sair — mas o relógio continua a andar e cada saída fica registada.
        </Rule>
        <Rule n={3}>
          Quando o tempo acabar, a folha é{" "}
          <strong className="text-white/90">recolhida como estiver</strong>. Fica
          o que já respondeste; o resto conta como não respondido. Não se
          reabre.
        </Rule>
        <Rule n={4}>
          Isto gasta{" "}
          <strong className="text-white/90">
            uma tentativa
            {attemptsLeft !== null
              ? ` — ficas com ${Math.max(0, attemptsLeft - 1)}`
              : ""}
          </strong>
          . Nota mínima {passingScore}%, {questions.length} perguntas.
        </Rule>
      </ol>

      <p className="mt-5 flex items-start gap-2 border-l-2 border-[#C535C9]/45 pl-3 text-[12.5px] leading-relaxed text-white/60">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f0a8ee]" />
        {gateLine} Faz isto quando tiveres {durationMinutes} minutos limpos pela
        frente — não entre duas reuniões.
      </p>

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={phase === "starting"}
          className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-semibold text-white shadow-[0_14px_40px_-16px_rgba(197,53,201,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "starting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Timer className="h-4 w-4" />
          )}
          Começar exame agora
        </button>
        <span className="text-[11.5px] text-white/35">
          Tentativa {attemptNumber}
          {maxAttempts !== null && ` de ${maxAttempts}`}
        </span>
      </div>

      {confirming && (
        <ConfirmDialog
          examLabel={examLabel}
          durationMinutes={durationMinutes}
          attemptNumber={attemptNumber}
          maxAttempts={maxAttempts}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void start()}
        />
      )}
    </div>
  );
}

function Rule({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[10.5px] font-bold text-white/60">
        {n}
      </span>
      <span className="text-[12.5px] leading-relaxed text-white/55">
        {children}
      </span>
    </li>
  );
}

/** A segunda confirmação. Deliberadamente seca: só diz o que vai acontecer no
 *  instante seguinte, e o botão que fecha é maior do que o que avança. */
function ConfirmDialog({
  examLabel,
  durationMinutes,
  attemptNumber,
  maxAttempts,
  onCancel,
  onConfirm,
}: {
  examLabel: string;
  durationMinutes: number;
  attemptNumber: number;
  maxAttempts: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[color:var(--background)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
            <Timer className="h-4 w-4 text-[#f0a8ee]" />
            Começar o exame da {examLabel} agora?
          </p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            className="rounded-lg p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-white/60">
          O cronómetro arranca <strong className="text-white/90">já</strong>, com{" "}
          {durationMinutes} minutos. Gasta a tentativa {attemptNumber}
          {maxAttempts !== null && ` de ${maxAttempts}`} — e, a partir daqui, a
          única forma de o parar é entregar.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/15 px-5 py-2.5 text-[13px] font-medium text-white/75 transition hover:border-white/35 hover:text-white"
          >
            Ainda não
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="brand-gradient-bg rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110"
          >
            Sim, começar
          </button>
        </div>
      </div>
    </div>
  );
}
