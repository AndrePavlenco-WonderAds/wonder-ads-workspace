// Overview da Formação (C-Level).
//
// FASE 1: tabela-base do roster — quem está em que trilha, progresso global e
// última atividade. Serve já para confirmar que o tracking está a gravar.
// A Fase 3 acrescenta filtros, drill-down por consultor com as respostas de
// cada teste, vista de produção de vídeos por presenter e o CMS de conteúdo.

import Link from "next/link";
import { ArrowLeft, GraduationCap, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ProgressBar } from "@/components/training/training-ui";
import { getTrainingCatalog } from "@/lib/training/content-store";
import {
  getEnrollments,
  rosterWithTracks,
} from "@/lib/training/enrollments-store";
import { getTrainingProgressMany } from "@/lib/training/progress-store";
import { getQuizAttemptsMany } from "@/lib/training/attempts-store";
import {
  computeUserTraining,
  currentModuleLabel,
  overallPercent,
} from "@/lib/training/progress";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Formação — Overview · Wonder Ads",
};

export default async function FormacaoAdminPage() {
  const [tracks, enrollments] = await Promise.all([
    getTrainingCatalog(),
    getEnrollments(),
  ]);
  const roster = rosterWithTracks(enrollments);
  const usernames = roster.map((r) => r.username);
  const [progressMap, attemptsMap] = await Promise.all([
    getTrainingProgressMany(usernames),
    getQuizAttemptsMany(usernames),
  ]);

  const rows = roster
    .map((user) => {
      const progress = progressMap[user.username] ?? {
        lessons: {},
        updatedAt: 0,
      };
      const attempts = attemptsMap[user.username] ?? [];
      const { common, specialization } = computeUserTraining(
        tracks,
        user.trackSlug,
        progress,
        attempts,
      );
      const watched =
        (common?.watchedLessons ?? 0) + (specialization?.watchedLessons ?? 0);
      const total =
        (common?.totalLessons ?? 0) + (specialization?.totalLessons ?? 0);
      return {
        user,
        percent: overallPercent(common, specialization),
        current: currentModuleLabel(common, specialization),
        watched,
        total,
        attempts: attempts.length,
        lastActivity: progress.updatedAt,
        trackName: specialization?.track.name ?? "—",
      };
    })
    .sort((a, b) => b.percent - a.percent || a.user.name.localeCompare(b.user.name, "pt"));

  return (
    <PageShell wide>
      <Link
        href="/formacao"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Formação
      </Link>

      <div className="animate-fade-up mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Formação — Overview</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Progresso de toda a equipa na Consultants Onboarding University. O
          drill-down por consultor, o checklist de gravação e o CMS de conteúdo
          entram na Fase 3.
        </p>
      </div>

      <section className="animate-fade-up mt-8">
        <header className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
          <Users className="h-4 w-4" />
          Equipa
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium tracking-normal text-white/60">
            {rows.length}
          </span>
        </header>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[880px] text-left text-[13px]">
            <thead className="bg-white/[0.03] text-[10.5px] uppercase tracking-[0.12em] text-white/45">
              <tr>
                <th className="px-4 py-3 font-semibold">Consultor</th>
                <th className="px-4 py-3 font-semibold">Especialização</th>
                <th className="px-4 py-3 font-semibold">Progresso global</th>
                <th className="px-4 py-3 font-semibold">Módulo atual</th>
                <th className="px-4 py-3 font-semibold">Aulas</th>
                <th className="px-4 py-3 font-semibold">Testes</th>
                <th className="px-4 py-3 font-semibold">Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.user.username}
                  className="border-t border-white/8 transition hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="brand-gradient-bg flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white">
                        {r.user.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {r.user.name}
                        </p>
                        <p className="text-[10.5px] text-white/40">
                          {r.user.role} · {r.user.dept}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-white/35" />
                      {r.trackName}
                    </span>
                    {!r.user.assigned && r.user.trackSlug && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-white/30">
                        (por dept)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <ProgressBar percent={r.percent} />
                      </div>
                      <span className="text-[12px] font-semibold text-white/80">
                        {r.percent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/60">{r.current}</td>
                  <td className="px-4 py-3 text-white/60">
                    {r.watched} de {r.total}
                  </td>
                  <td className="px-4 py-3 text-white/60">{r.attempts}</td>
                  <td className="px-4 py-3 text-white/50">
                    {r.lastActivity ? formatDateTime(r.lastActivity) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
