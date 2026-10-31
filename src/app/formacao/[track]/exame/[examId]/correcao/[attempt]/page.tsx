// A correção de uma tentativa de exame, guardada (v78.63).
//
// Até aqui a correção só existia no ecrã logo a seguir à entrega — e quem
// passava o exame via-a um ou dois segundos, porque a página atualizava e o
// exame passava a «passado». Agora cada tentativa tem a sua página: a nota, o
// que correu mal por capítulo e, pergunta a pergunta, a tua resposta ao lado
// da certa, com o sítio onde voltar a estudar. Reconstruída a partir do que a
// tentativa gravou (`exam-correction.ts`); só a própria pessoa a vê.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileCheck2, XCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { CorrectionList } from "@/components/training/attempt-correction";
import { TopicBreakdown } from "@/components/training/exam-sheet";
import { getTrainingContext } from "@/lib/training/server";
import { examHref, findExam } from "@/lib/training/exams";
import { attemptCorrection } from "@/lib/training/exam-correction";
import { getExamSession } from "@/lib/training/exam-sessions-store";
import { studyLinks } from "@/lib/training/study-links";
import type { QuestionTopic } from "@/lib/training/grading";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string; examId: string; attempt: string }>;
}): Promise<Metadata> {
  const { examId, attempt } = await params;
  const exam = findExam(examId);
  return {
    title: exam
      ? `Correção · ${exam.title} · tentativa ${attempt} · Formação · Wonder Ads`
      : "Correção · Formação · Wonder Ads",
  };
}

export default async function ExamCorrectionPage({
  params,
}: {
  params: Promise<{ track: string; examId: string; attempt: string }>;
}) {
  const { track, examId, attempt: attemptParam } = await params;
  const exam = findExam(examId);
  if (!exam || exam.trackSlug !== track) notFound();

  const ctx = await getTrainingContext();
  if (!ctx) redirect(`/login?next=${examHref(exam)}`);

  const state = ctx.exams.exams.find((e) => e.exam.id === examId);
  const attempt = state?.attempts.find((a) => String(a.attemptNumber) === attemptParam);
  if (!state || !attempt) notFound();

  // A semente da folha: a da tentativa ou, nas tentativas de antes de ela se
  // guardar, a da sessão — enquanto a sessão for ainda a desta tentativa.
  const session = attempt.paperSeed ? null : await getExamSession(ctx.employee.username, exam.id);
  const seed =
    attempt.paperSeed ??
    (session && session.attemptNumber === attempt.attemptNumber ? (session.seed ?? null) : null);

  const rows = attemptCorrection(exam, ctx.tracks, attempt, seed, studyLinks(ctx.tracks, exam.trackSlug));
  const wrong = rows.filter((r) => !r.isCorrect && !r.manualReview).length;

  const byTopic = new Map<string, { topic: QuestionTopic; right: number; total: number }>();
  for (const r of rows) {
    if (!r.topic || r.manualReview) continue;
    const row = byTopic.get(r.topic.key) ?? { topic: r.topic, right: 0, total: 0 };
    row.total += 1;
    if (r.isCorrect) row.right += 1;
    byTopic.set(r.topic.key, row);
  }
  const topicRows = [...byTopic.values()].sort((a, b) => (a.topic.no ?? 0) - (b.topic.no ?? 0));

  return (
    <PageShell backHref={examHref(exam)} backLabel={exam.title} wide>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header
          className={`animate-fade-up rounded-2xl border p-6 ${
            attempt.passed
              ? "border-emerald-400/30 bg-emerald-500/[0.07]"
              : "border-rose-400/30 bg-rose-500/[0.07]"
          }`}
        >
          <p className="readout inline-flex items-center gap-1.5 text-white/45">
            <FileCheck2 className="h-3 w-3" />
            Correção · {exam.label} · tentativa {attempt.attemptNumber}
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span
                className={`tabular flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold ${
                  attempt.passed ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {attempt.score}%
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
                  {attempt.passed ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-rose-300" />
                  )}
                  {exam.title}
                </h1>
                <p className="tabular mt-1 text-[13px] text-white/60">
                  {attempt.passed ? "Passou" : "Não chegou à nota mínima"} · mínimo {exam.passingScore}% ·{" "}
                  {wrong === 0 ? "todas certas" : `${wrong} errada${wrong === 1 ? "" : "s"} em ${rows.length}`} · entregue a{" "}
                  {formatDateTime(attempt.submittedAt)}
                </p>
              </div>
            </div>
            <Link
              href={examHref(exam)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/12 px-4 py-2.5 text-[13px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao exame
            </Link>
          </div>
          {wrong > 0 && (
            <p className="mt-4 flex items-start gap-2 border-t border-white/[0.07] pt-4 text-[12.5px] leading-relaxed text-white/60">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" />
              Abre nas que erraste: a tua resposta, a certa, e a aula onde isso se dá. Em «Todas» tens a folha
              inteira, pela ordem em que a viste.
            </p>
          )}
        </header>

        <TopicBreakdown rows={topicRows} passingScore={exam.passingScore} />

        <CorrectionList rows={rows} initialFilter="wrong" />
      </div>
    </PageShell>
  );
}
