// Um exame de fase.
//
// DESENHO — a página tem de PARECER um exame, não um quiz com outro título.
// Por isso: sem migalhas de capítulo, sem "fim do capítulo", sem sugestão de
// continuar. Um cabeçalho que diz o que está em jogo, as condições em números
// (nota mínima, tentativas, perguntas), e o gate — quando está fechado, diz
// exatamente porquê e desde quando/até quando.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { QuizRunner } from "@/components/training/quiz-runner";
import { getTrainingContext } from "@/lib/training/server";
import { examQuiz, findExam } from "@/lib/training/exams";
import { seededShuffle, toPublicQuestions } from "@/lib/training/grading";
import { formatDate, formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ examId: string }>;
}): Promise<Metadata> {
  const { examId } = await params;
  const exam = findExam(examId);
  return {
    title: exam
      ? `${exam.title} · Formação · Wonder Ads`
      : "Exame · Formação · Wonder Ads",
  };
}

export default async function ExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const exam = findExam(examId);
  if (!exam) notFound();

  const ctx = await getTrainingContext();
  if (!ctx) redirect(`/login?next=/formacao/exame/${examId}`);

  const state = ctx.exams.exams.find((e) => e.exam.id === examId);
  if (!state) notFound();

  const quiz = examQuiz(exam);
  const attemptNumber = state.attemptsUsed + 1;

  // Ordem baralhada mas estável dentro da mesma tentativa — um F5 a meio de
  // um exame não pode reordenar as perguntas.
  const ordered = seededShuffle(
    quiz.questions,
    `${ctx.employee.username}:${exam.id}:${attemptNumber}`,
  );

  const blocker =
    state.status === "no_start"
      ? {
          icon: <CalendarClock className="h-4 w-4" />,
          title: "Data de entrada por definir",
          text: "O relógio dos exames arranca na tua data de entrada e ela ainda não está registada. Fala com o Andre, o Alex ou a Alice.",
        }
      : state.status === "no_questions"
        ? {
            icon: <AlertTriangle className="h-4 w-4" />,
            title: "Exame ainda por escrever",
            text: "Este exame ainda não tem perguntas. Não bloqueia a tua progressão enquanto assim for.",
          }
        : state.status === "locked_time"
          ? {
              icon: <Lock className="h-4 w-4" />,
              title: `Abre a ${formatDate(state.unlockAt)}`,
              text: `Este exame é dos ${exam.milestone} e abre nessa data — ${
                state.daysUntil === 1
                  ? "falta 1 dia"
                  : `faltam ${state.daysUntil} dias`
              }. Até lá, o que há a fazer são as aulas e os quizzes dos capítulos.`,
            }
          : state.status === "locked_prev"
            ? {
                icon: <Lock className="h-4 w-4" />,
                title: "Exame anterior por passar",
                text: "Os exames abrem por ordem. Passa o anterior para este ficar disponível.",
              }
            : state.status === "exhausted"
              ? {
                  icon: <ShieldAlert className="h-4 w-4" />,
                  title: "Sem tentativas",
                  text: "Usaste as tentativas deste exame sem chegar à nota mínima. A decisão passa para o C-Level — fala com o Andre, o Alex ou a Alice.",
                }
              : state.status === "passed"
                ? {
                    icon: <CheckCircle2 className="h-4 w-4" />,
                    title: "Exame passado",
                    text: exam.final
                      ? "Passaste o exame final. Estás efetivo — não há nada a repetir aqui."
                      : "Já passaste este exame. Um exame passado não se repete; o que interessa agora é o seguinte.",
                  }
                : null;

  const tone =
    state.status === "passed"
      ? "emerald"
      : state.status === "exhausted"
        ? "rose"
        : "amber";

  return (
    <PageShell backHref="/formacao" backLabel="Formação" wide>
      <div className="mx-auto w-full max-w-4xl">
        {/* ===== Cabeçalho ===== */}
        <header className="animate-fade-up relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.022] p-6 sm:p-8">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full opacity-[0.16] blur-3xl"
            style={{ background: "var(--brand-gradient)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(197,53,201,0.7), rgba(120,61,245,0.4), transparent)",
            }}
          />

          <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="readout inline-flex items-center gap-1.5 rounded-full border border-[#C535C9]/35 bg-[#C535C9]/[0.09] px-2.5 py-1 text-[#f0a8ee]">
              <Target className="h-3 w-3" />
              Exame de fase
            </span>
            <span className="readout text-white/35">
              {exam.label} · {exam.milestone}
            </span>
            {state.passed && (
              <span className="readout inline-flex items-center gap-1.5 text-emerald-300/85">
                <CheckCircle2 className="h-3 w-3" />
                Passado · {state.bestScore}%
              </span>
            )}
          </div>

          <h1 className="relative mt-3 text-[1.7rem] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[2.3rem]">
            <span className="brand-gradient-text">{exam.title}</span>
          </h1>
          <p className="relative mt-3 max-w-2xl text-[13.5px] leading-relaxed text-white/55">
            {exam.description}
          </p>

          <div className="relative mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Condition label="Nota mínima" value={`${exam.passingScore}%`} />
            <Condition
              label="Tentativas"
              value={
                exam.maxAttempts === null
                  ? "ilimitadas"
                  : `${state.attemptsUsed}/${exam.maxAttempts}`
              }
            />
            <Condition label="Perguntas" value={state.questionCount} />
            <Condition
              label="Abre a"
              value={state.unlockAt ? formatDate(state.unlockAt) : "—"}
            />
          </div>

          <p className="relative mt-5 flex items-start gap-2 border-l-2 border-[#C535C9]/45 pl-3 text-[12.5px] leading-relaxed text-white/60">
            {exam.final ? (
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f0a8ee]" />
            ) : (
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f0a8ee]" />
            )}
            {exam.gate}{" "}
            {exam.maxAttempts !== null &&
              `Tens ${exam.maxAttempts} tentativas — não é um quiz, não se repete até acertar.`}
          </p>
        </header>

        {blocker ? (
          <div
            className={`animate-fade-up mt-6 rounded-2xl border px-5 py-6 ${
              tone === "emerald"
                ? "border-emerald-400/25 bg-emerald-500/[0.06]"
                : tone === "rose"
                  ? "border-rose-400/30 bg-rose-500/[0.07]"
                  : "border-amber-400/25 bg-amber-500/[0.07]"
            }`}
          >
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${
                tone === "emerald"
                  ? "text-emerald-100/90"
                  : tone === "rose"
                    ? "text-rose-100/90"
                    : "text-amber-100/90"
              }`}
            >
              {blocker.icon}
              {blocker.title}
            </p>
            <p
              className={`mt-2 max-w-2xl text-[13px] leading-relaxed ${
                tone === "emerald"
                  ? "text-emerald-100/70"
                  : tone === "rose"
                    ? "text-rose-100/70"
                    : "text-amber-100/70"
              }`}
            >
              {blocker.text}
            </p>
            <Link
              href="/formacao"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:border-[#783DF5]/40 hover:text-white"
            >
              Voltar à Formação
            </Link>
          </div>
        ) : (
          <div className="animate-fade-up mt-8">
            <QuizRunner
              variant="exam"
              quizId={exam.id}
              submitUrl={`/api/formacao/exame/${exam.id}/submit`}
              questions={toPublicQuestions(ordered)}
              passingScore={exam.passingScore}
              attemptNumber={attemptNumber}
              attemptsLeft={state.attemptsLeft}
              trackHref="/formacao"
              nextHref="/formacao"
              backLabel="Voltar à Formação"
              gateLine={exam.gate}
            />
          </div>
        )}

        {state.attempts.length > 0 && (
          <section className="animate-fade-up mt-10">
            <h2 className="readout mb-3 text-white/40">As tuas tentativas</h2>
            <ul className="space-y-2">
              {state.attempts.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-[12.5px]"
                >
                  <span className="font-medium text-white/70">
                    Tentativa {a.attemptNumber}
                  </span>
                  <span
                    className={`tabular rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      a.passed
                        ? "bg-emerald-500/12 text-emerald-300"
                        : "bg-rose-500/12 text-rose-300"
                    }`}
                  >
                    {a.score}% · {a.passed ? "passou" : "chumbou"}
                  </span>
                  <span className="tabular ml-auto text-white/40">
                    {formatDateTime(a.submittedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}

/** Uma condição do exame, em formato de leitura de painel. */
function Condition({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5">
      <p className="readout text-white/32">{label}</p>
      <p className="tabular mt-1 text-[15px] font-semibold text-white/90">
        {value}
      </p>
    </div>
  );
}
