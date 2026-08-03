// Checklist de gravações — o estado de produção do conteúdo, por trilha e
// por apresentador.
//
// Serve uma pergunta concreta: "o que é que eu (Alice / Alex / André) tenho
// para gravar?". Por isso a página abre com o resumo por pessoa e só depois
// desce ao detalhe trilha a trilha.

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Film,
  UserRound,
  Video,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TrainingAdminNav } from "@/components/training/admin-nav";
import {
  LessonThumb,
  LessonTypeBadge,
  ProgressBar,
  StatTile,
} from "@/components/training/training-ui";
import { getTrainingCatalog } from "@/lib/training/content-store";
import { contentStats } from "@/lib/training/admin";
import { LESSON_TYPE_LABEL } from "@/lib/training/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Gravações — Formação · Wonder Ads",
};

const UNASSIGNED = "__unassigned__";

export default async function ContentChecklistPage() {
  const tracks = await getTrainingCatalog();
  const stats = contentStats(tracks);

  const allLessons = tracks.flatMap((t) =>
    t.modules.flatMap((m) =>
      m.lessons.map((l) => ({ track: t, module: m, lesson: l })),
    ),
  );
  const recorded = allLessons.filter((x) => x.lesson.videoUrl).length;
  const percent = allLessons.length
    ? Math.round((recorded / allLessons.length) * 100)
    : 0;

  // Resumo por apresentador — quem tem quantas por gravar.
  const byPresenter = new Map<
    string,
    { total: number; done: number; pending: typeof allLessons }
  >();
  for (const row of allLessons) {
    const key = row.lesson.presenter ?? UNASSIGNED;
    const entry = byPresenter.get(key) ?? { total: 0, done: 0, pending: [] };
    entry.total += 1;
    if (row.lesson.videoUrl) entry.done += 1;
    else entry.pending.push(row);
    byPresenter.set(key, entry);
  }
  const presenters = Array.from(byPresenter.entries()).sort((a, b) => {
    // Por atribuir fica sempre no fim; o resto por número de pendentes.
    if (a[0] === UNASSIGNED) return 1;
    if (b[0] === UNASSIGNED) return -1;
    return b[1].pending.length - a[1].pending.length;
  });

  return (
    <PageShell wide>
      <Link
        href="/formacao/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Formação — Overview
      </Link>

      <div className="animate-fade-up mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Gravações</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            O que já está gravado, o que falta e de quem é cada gravação. Os
            vídeos carregam-se em Conteúdo, colando o link do YouTube, Vimeo ou
            Loom na aula.
          </p>
        </div>
        <TrainingAdminNav />
      </div>

      <section className="animate-fade-up mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Gravadas"
          value={`${recorded}/${allLessons.length}`}
          hint={`${percent}% do programa`}
          tone={recorded === allLessons.length ? "good" : "default"}
          icon={<Video className="h-3 w-3" />}
        />
        <StatTile
          label="Por gravar"
          value={stats.missingVideos}
          tone={stats.missingVideos > 0 ? "warn" : "good"}
          icon={<Film className="h-3 w-3" />}
        />
        <StatTile
          label="Sem apresentador"
          value={stats.unassignedPresenters}
          hint="por atribuir"
          tone={stats.unassignedPresenters > 0 ? "warn" : "good"}
          icon={<UserRound className="h-3 w-3" />}
        />
        <StatTile
          label="Testes por escrever"
          value={stats.quizzesMissing}
          hint="módulos sem perguntas"
          tone={stats.quizzesMissing > 0 ? "warn" : "good"}
          icon={<ClipboardCheck className="h-3 w-3" />}
        />
      </section>

      <div className="animate-fade-up mt-5">
        <ProgressBar percent={percent} />
      </div>

      {/* Por apresentador */}
      <section className="animate-fade-up mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
          Por apresentador
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {presenters.map(([name, entry]) => {
            const unassigned = name === UNASSIGNED;
            const pct = Math.round((entry.done / entry.total) * 100);
            return (
              <div
                key={name}
                className={`rounded-2xl border p-5 ${
                  unassigned
                    ? "border-amber-400/25 bg-amber-500/[0.05]"
                    : "border-white/10 bg-white/[0.025]"
                }`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold text-white">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                        unassigned
                          ? "bg-amber-500/15 text-amber-200"
                          : "brand-gradient-bg text-white"
                      }`}
                    >
                      {unassigned ? "?" : name.trim().charAt(0).toUpperCase()}
                    </span>
                    {unassigned ? "Por atribuir" : name}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      entry.pending.length === 0
                        ? "bg-emerald-500/12 text-emerald-300"
                        : "bg-white/[0.06] text-white/70"
                    }`}
                  >
                    {entry.pending.length === 0
                      ? "tudo gravado"
                      : `${entry.pending.length} por gravar`}
                  </span>
                </header>

                <div className="mt-3 flex items-center gap-2">
                  <ProgressBar percent={pct} />
                  <span className="shrink-0 text-[11px] text-white/45">
                    {entry.done}/{entry.total}
                  </span>
                </div>

                {entry.pending.length > 0 && (
                  <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
                    {entry.pending.map(({ track, module, lesson }) => (
                      <li
                        key={lesson.id}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] odd:bg-white/[0.02]"
                      >
                        <LessonThumb type={lesson.type} comingSoon size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-white/80">
                            {lesson.title}
                          </span>
                          <span className="block truncate text-[10.5px] text-white/35">
                            {track.name} · {module.title}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/35">
                          {LESSON_TYPE_LABEL[lesson.type]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Detalhe por trilha */}
      <section className="animate-fade-up mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
          Programa completo
        </h2>
        <div className="space-y-6">
          {tracks.map((t) => {
            const lessons = t.modules.flatMap((m) => m.lessons);
            const done = lessons.filter((l) => l.videoUrl).length;
            return (
              <div
                key={t.slug}
                className="rounded-2xl border border-white/10 bg-white/[0.022] p-5"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-white">
                    {t.name}
                  </h3>
                  <span className="text-[11.5px] text-white/45">
                    {done}/{lessons.length} gravadas ·{" "}
                    {t.modules.filter((m) => m.quiz.questions.length === 0)
                      .length}{" "}
                    testes por escrever
                  </span>
                </header>

                <div className="mt-4 space-y-4">
                  {t.modules.map((m) => (
                    <div key={m.id}>
                      <p className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-white/70">
                        {m.section && (
                          <span className="text-[10px] uppercase tracking-wide text-[#A9834F]">
                            {m.section} ·
                          </span>
                        )}
                        {m.title}
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${
                            m.quiz.questions.length > 0
                              ? "bg-white/[0.06] text-white/45"
                              : "bg-amber-500/12 text-amber-200/80"
                          }`}
                        >
                          {m.quiz.questions.length > 0
                            ? `${m.quiz.questions.length} perguntas`
                            : "teste por escrever"}
                        </span>
                      </p>
                      <ul className="space-y-0.5">
                        {m.lessons.map((l) => (
                          <li
                            key={l.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] odd:bg-white/[0.015]"
                          >
                            {l.videoUrl ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                            ) : (
                              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-amber-400/40" />
                            )}
                            <span
                              className={
                                l.videoUrl ? "text-white/80" : "text-white/55"
                              }
                            >
                              {l.title}
                            </span>
                            <LessonTypeBadge type={l.type} />
                            <span className="ml-auto shrink-0 text-[11px]">
                              {l.presenter ? (
                                <span className="text-white/45">
                                  {l.presenter}
                                </span>
                              ) : (
                                <span className="text-amber-200/70">
                                  por atribuir
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
