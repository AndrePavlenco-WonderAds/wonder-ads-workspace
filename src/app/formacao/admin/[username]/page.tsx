// Drill-down de um consultor: linha temporal de atividade, cada aula com o
// percent_watched real e a data de conclusão, e cada tentativa de teste com as
// respostas dadas pergunta a pergunta.
//
// É aqui que a formação deixa de ser uma barra de progresso e passa a ser
// informação útil: ver que alguém passou o teste com 80% mas errou justamente
// a pergunta sobre escalar problemas vale mais do que a percentagem.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Film,
  Gauge,
  Lock,
  Target,
  XCircle,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ExamRail, NextExamCard } from "@/components/training/exam-rail";
import {
  LessonThumb,
  LessonTypeBadge,
  ModuleStatusChip,
  ProgressBar,
  ProgressRing,
  StatTile,
} from "@/components/training/training-ui";
import { getRosterRow } from "@/lib/training/admin";
import { getTrainingCatalog } from "@/lib/training/content-store";
import { EXAM_QUESTIONS } from "@/lib/training/exam-questions";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { TrackState } from "@/lib/training/progress";
import type { QuizAttempt } from "@/lib/training/attempts-store";
import type { TrainingQuestion, TrainingTrack } from "@/lib/training/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const row = await getRosterRow(username);
  return {
    title: row
      ? `${row.user.name} · Formação — Superadmin · Wonder Ads`
      : "Formação — Superadmin · Wonder Ads",
  };
}

/** Índice pergunta-id → pergunta, para mostrar o enunciado ao lado da
 *  resposta dada. Cobre os quizzes do catálogo E os seis exames — sem os
 *  exames, uma tentativa de exame aberta aqui mostrava ids em vez de
 *  enunciados. Uma pergunta apagada do CMS depois da tentativa deixa de ter
 *  enunciado — mostramos o id em vez de esconder a resposta. */
function questionIndex(tracks: TrainingTrack[]): Map<string, TrainingQuestion> {
  const map = new Map<string, TrainingQuestion>();
  for (const t of tracks)
    for (const m of t.modules)
      for (const q of m.quiz.questions) map.set(q.id, q);
  for (const list of Object.values(EXAM_QUESTIONS))
    for (const q of list) map.set(q.id, q);
  return map;
}

export default async function ConsultantDrillDownPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [row, tracks] = await Promise.all([
    getRosterRow(username),
    getTrainingCatalog(),
  ]);
  if (!row) notFound();

  const questions = questionIndex(tracks);
  const trackStates = [row.common, ...row.specializations].filter(
    (t): t is TrackState => t !== null,
  );

  // Tentativas de quiz e de exame vivem na mesma lista guardada em KV, mas
  // dizem coisas diferentes: um chumbo num quiz é matéria por assentar, um
  // chumbo num exame é uma decisão de fase. Mostram-se juntas — porque a
  // ordem cronológica é a leitura útil — mas cada linha diz qual é qual.
  type AttemptRow = { attempt: QuizAttempt; title: string; isExam: boolean };
  const examAttempts: AttemptRow[] = row.exams.exams.flatMap((e) =>
    e.attempts.map((a) => ({
      attempt: a,
      title: `${e.exam.label} · ${e.exam.title}`,
      isExam: true,
    })),
  );
  const quizAttempts: AttemptRow[] = row.attempts.map((a) => ({
    attempt: a,
    title:
      tracks.flatMap((t) => t.modules).find((m) => m.quiz.id === a.quizId)?.quiz
        .title ?? a.quizId,
    isExam: false,
  }));
  const attemptRows = [...examAttempts, ...quizAttempts].sort(
    (x, y) => y.attempt.submittedAt - x.attempt.submittedAt,
  );

  // Linha temporal: aulas concluídas + tentativas, do mais recente para o
  // mais antigo.
  type Event =
    | { kind: "lesson"; at: number; title: string; percent: number; manual: boolean }
    | {
        kind: "attempt";
        at: number;
        attempt: QuizAttempt;
        title: string;
        isExam: boolean;
      };
  const events: Event[] = [];
  for (const t of trackStates) {
    for (const m of t.modules) {
      for (const l of m.lessons) {
        if (l.completedAt) {
          events.push({
            kind: "lesson",
            at: l.completedAt,
            title: l.lesson.title,
            percent: l.percent,
            manual: l.manual,
          });
        }
      }
    }
  }
  for (const r of attemptRows) {
    events.push({
      kind: "attempt",
      at: r.attempt.submittedAt,
      attempt: r.attempt,
      title: r.title,
      isExam: r.isExam,
    });
  }
  events.sort((a, b) => b.at - a.at);

  return (
    <PageShell wide>
      <Link
        href="/formacao/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Formação — Superadmin
      </Link>

      {/* Cabeçalho */}
      <section className="animate-fade-up mt-6 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-4">
          <span className="brand-gradient-bg flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white">
            {row.user.name.trim().charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {row.user.name}
            </h1>
            <p className="mt-0.5 text-[12.5px] text-white/45">
              {row.user.role} · {row.user.dept} ·{" "}
              {row.specializations.length > 0
                ? row.specializations.map((s) => s.track.name).join(" · ")
                : "sem especialização"}
              {row.user.assigned && row.user.assignedBy && (
                <span className="text-white/30">
                  {" "}
                  (atribuída por {row.user.assignedBy})
                </span>
              )}
            </p>
            <p className="tabular mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-white/35">
              <span>
                Última atividade:{" "}
                {row.lastActivity ? formatDateTime(row.lastActivity) : "nunca"}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Entrou a{" "}
                {row.startedAt
                  ? formatDate(`${row.startedAt}T00:00:00`)
                  : "— (por definir)"}
                {!row.startDateExplicit && row.startedAt && (
                  <span className="text-white/25"> (default)</span>
                )}
              </span>
            </p>
          </div>
        </div>
        <ProgressRing percent={row.percent} label="global" size={110} />
      </section>

      <section className="animate-fade-up mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Aulas vistas"
          value={`${row.watched}/${row.allLessons}`}
          icon={<Film className="h-3 w-3" />}
        />
        <StatTile
          label="Quizzes passados"
          value={`${row.quizzesPassed}/${row.quizzesTotal}`}
          hint="por capítulo · repetíveis"
          icon={<ClipboardCheck className="h-3 w-3" />}
        />
        <StatTile
          label="Exames passados"
          value={`${row.exams.passedCount}/${row.exams.exams.length}`}
          hint={row.exams.blocked ? "sem tentativas num deles" : "decidem a fase"}
          tone={
            row.exams.blocked
              ? "warn"
              : row.exams.effective
                ? "good"
                : "default"
          }
          icon={<Target className="h-3 w-3" />}
        />
        <StatTile
          label="Tentativas"
          value={row.attempts.length}
          hint={
            row.failedAttempts > 0
              ? `${row.failedAttempts} chumbada(s)`
              : "sem chumbos"
          }
          tone={row.failedAttempts > 0 ? "warn" : "default"}
          icon={<Gauge className="h-3 w-3" />}
        />
        {/* Quando é o próximo exame desta pessoa — e o selo verde de EFETIVO
            assim que ela passa o dos 90 dias. */}
        <NextExamCard journey={row.exams} subject="Tem" />
      </section>

      <section className="animate-fade-up mt-3">
        <StatTile
          label="Capítulo atual"
          value={
            <span className="text-[15px] leading-snug">{row.currentLabel}</span>
          }
          icon={<Clock className="h-3 w-3" />}
        />
      </section>

      {/* ===== Exames de fase ===== */}
      <div className="animate-fade-up mt-6">
        <ExamRail journey={row.exams} interactive={false} />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.15fr_1fr]">
        {/* Módulos, aula a aula */}
        <div className="animate-fade-up space-y-8">
          {trackStates.map((t) => (
            <section key={t.track.slug}>
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
                  {t.track.name}
                </h2>
                <span className="text-[12px] font-semibold text-white/70">
                  {t.percent}%
                </span>
                {t.lockedReason && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/12 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/40">
                    <Lock className="h-2.5 w-2.5" />
                    trancada
                  </span>
                )}
              </header>
              <div className="space-y-3">
                {t.modules.map((m) => (
                  <div
                    key={m.module.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.022] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-[13.5px] font-semibold text-white/90">
                        {m.module.title}
                      </h3>
                      <ModuleStatusChip
                        status={m.status}
                        percent={m.percent}
                        hasContent={m.hasContent}
                      />
                    </div>
                    <div className="mt-2.5">
                      <ProgressBar percent={m.percent} />
                    </div>
                    <ul className="mt-3 space-y-1">
                      {m.lessons.map((l) => (
                        <li
                          key={l.lesson.id}
                          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] odd:bg-white/[0.015]"
                        >
                          <LessonThumb
                            type={l.lesson.type}
                            watched={l.watched}
                            comingSoon={l.comingSoon}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={
                                  l.comingSoon ? "text-white/40" : "text-white/85"
                                }
                              >
                                {l.lesson.title}
                              </span>
                              <LessonTypeBadge type={l.lesson.type} />
                              {l.manual && (
                                <span
                                  title="Confirmação manual — o Loom não permite medir a visualização"
                                  className="rounded-full border border-white/12 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/35"
                                >
                                  manual
                                </span>
                              )}
                            </span>
                            {l.completedAt && (
                              <span className="block text-[10.5px] text-white/35">
                                concluída {formatDateTime(l.completedAt)}
                              </span>
                            )}
                          </span>
                          <span
                            className={`shrink-0 text-[11.5px] font-semibold ${
                              l.watched
                                ? "text-emerald-300"
                                : l.percent > 0
                                  ? "text-amber-200/80"
                                  : "text-white/25"
                            }`}
                          >
                            {l.comingSoon ? "—" : `${l.percent}%`}
                          </span>
                        </li>
                      ))}
                      {m.quizRequired && (
                        <li className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px]">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/50">
                            <ClipboardCheck className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 text-white/70">
                            {m.module.quiz.title}
                            <span className="ml-1.5 text-[10.5px] text-white/35">
                              {m.quizAttempts} tentativa(s)
                            </span>
                          </span>
                          <span
                            className={`shrink-0 text-[11.5px] font-semibold ${
                              m.quizPassed ? "text-emerald-300" : "text-white/25"
                            }`}
                          >
                            {m.quizBestScore === null
                              ? "—"
                              : `${m.quizBestScore}%`}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Tentativas + timeline */}
        <div className="animate-fade-up space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
              Tentativas
            </h2>
            {attemptRows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center text-[13px] text-white/40">
                Ainda não fez nenhum quiz nem nenhum exame.
              </p>
            ) : (
              <div className="space-y-3">
                {attemptRows.map(({ attempt: a, title, isExam }) => {
                  const wrong = a.answers.filter((x) => !x.isCorrect).length;
                  return (
                    <details
                      key={a.id}
                      className={`group rounded-2xl border p-4 ${
                        isExam
                          ? "border-[#C535C9]/25 bg-[#C535C9]/[0.04]"
                          : "border-white/10 bg-white/[0.022]"
                      }`}
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2.5 text-[13px] marker:content-['']">
                        <span
                          className={`tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ${
                            a.passed
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {a.score}%
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            {isExam && (
                              <span className="readout shrink-0 rounded-full border border-[#C535C9]/35 bg-[#C535C9]/10 px-1.5 py-0.5 text-[#f0a8ee]">
                                Exame
                              </span>
                            )}
                            <span className="truncate font-medium text-white/90">
                              {title}
                            </span>
                          </span>
                          <span className="tabular block text-[10.5px] text-white/40">
                            tentativa {a.attemptNumber} ·{" "}
                            {formatDateTime(a.submittedAt)} ·{" "}
                            {wrong === 0
                              ? "todas certas"
                              : `${wrong} errada(s)`}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            a.passed
                              ? "bg-emerald-500/12 text-emerald-300"
                              : "bg-rose-500/12 text-rose-300"
                          }`}
                        >
                          {a.passed ? "passou" : "chumbou"}
                        </span>
                      </summary>

                      <ul className="mt-4 space-y-2.5 border-t border-white/8 pt-4">
                        {a.answers.map((ans, i) => {
                          const q = questions.get(ans.questionId);
                          return (
                            <li key={ans.questionId} className="text-[12.5px]">
                              <p className="flex items-start gap-2 font-medium text-white/85">
                                {ans.isCorrect ? (
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                                ) : (
                                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                                )}
                                <span>
                                  {i + 1}. {q?.prompt ?? ans.questionId}
                                </span>
                              </p>
                              <p className="mt-1 pl-5.5 text-white/50">
                                <span className="text-white/35">
                                  Respondeu:{" "}
                                </span>
                                {ans.text
                                  ? ans.text
                                  : ans.optionIds.length === 0
                                    ? "— (em branco)"
                                    : ans.optionIds
                                        .map(
                                          (id) =>
                                            q?.options.find((o) => o.id === id)
                                              ?.text ?? id,
                                        )
                                        .join(" · ")}
                              </p>
                              {!ans.isCorrect && q && (
                                <p className="mt-0.5 pl-5.5 text-emerald-200/70">
                                  <span className="text-white/35">
                                    Correta:{" "}
                                  </span>
                                  {q.options
                                    .filter((o) => o.isCorrect)
                                    .map((o) => o.text)
                                    .join(" · ")}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
              Atividade
            </h2>
            {events.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center text-[13px] text-white/40">
                Sem atividade registada.
              </p>
            ) : (
              <ol className="relative space-y-3 border-l border-white/10 pl-5">
                {events.slice(0, 40).map((e, i) => (
                  <li key={`${e.kind}-${e.at}-${i}`} className="relative">
                    <span
                      className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${
                        e.kind === "attempt"
                          ? e.attempt.passed
                            ? "bg-emerald-400"
                            : "bg-rose-400"
                          : "bg-[#783DF5]"
                      }`}
                    />
                    <p className="text-[12.5px] text-white/80">
                      {e.kind === "lesson" ? (
                        <>
                          Concluiu <span className="font-medium">{e.title}</span>
                          <span className="text-white/40">
                            {" "}
                            ({e.percent}%{e.manual ? ", manual" : ""})
                          </span>
                        </>
                      ) : (
                        <>
                          {e.attempt.passed ? "Passou" : "Chumbou"}{" "}
                          {e.isExam && (
                            <span className="text-[#f0a8ee]">o exame </span>
                          )}
                          <span className="font-medium">{e.title}</span>
                          <span className="tabular text-white/40">
                            {" "}
                            ({e.attempt.score}%)
                          </span>
                        </>
                      )}
                    </p>
                    <p className="text-[10.5px] text-white/35">
                      {formatDateTime(e.at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
