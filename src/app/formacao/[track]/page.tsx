// Página de uma track: módulos (agrupados por secção quando existe), estado
// de cada um (bloqueado / em curso / concluído) e as aulas de cada módulo.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  Lock,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  LessonTypeBadge,
  MinutesLeft,
  ModuleStatusChip,
  ProgressBar,
  ProgressRing,
} from "@/components/training/training-ui";
import { getTrainingContext, trackStateFor } from "@/lib/training/server";
import { lessonMinutes } from "@/lib/training/catalog";
import type { ModuleState } from "@/lib/training/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string }>;
}): Promise<Metadata> {
  const { track } = await params;
  const ctx = await getTrainingContext();
  const state = ctx ? trackStateFor(ctx, track) : null;
  return {
    title: state
      ? `${state.track.name} · Formação · Wonder Ads`
      : "Formação · Wonder Ads",
  };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ track: string }>;
}) {
  const { track: slug } = await params;
  const ctx = await getTrainingContext();
  if (!ctx) redirect(`/login?next=/formacao/${slug}`);

  // Só se abre uma track em que o utilizador está inscrito — a especialização
  // de outro departamento devolve 404, não uma página vazia.
  const state = trackStateFor(ctx, slug);
  if (!state) notFound();

  // Agrupar módulos consecutivos com a mesma secção (ex.: Service Delivery).
  const groups: { section: string | null; modules: ModuleState[] }[] = [];
  for (const m of state.modules) {
    const last = groups[groups.length - 1];
    if (last && last.section === m.module.section) last.modules.push(m);
    else groups.push({ section: m.module.section, modules: [m] });
  }

  // O primeiro módulo aberto é o "onde estás" — destacado uma única vez.
  const currentModuleId =
    state.modules.find((m) => m.status === "in_progress")?.module.id ?? null;
  const orderIndex = new Map(
    state.modules.map((m, i) => [m.module.id, i + 1] as const),
  );

  return (
    <PageShell backHref="/formacao" backLabel="Formação">
      <div className="animate-fade-up flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">{state.track.name}</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {state.track.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/45">
            <span>
              {state.watchedLessons}/{state.totalLessons} aulas vistas
            </span>
            <span>·</span>
            <span>{state.modules.length} módulos</span>
            {state.missingVideos > 0 && (
              <>
                <span>·</span>
                <span className="text-amber-200/70">
                  {state.missingVideos} aulas por gravar
                </span>
              </>
            )}
            <MinutesLeft minutes={state.minutesLeft} />
          </div>
        </div>
        <ProgressRing percent={state.percent} label="da trilha" />
      </div>

      {state.lockedReason && (
        <div className="animate-fade-up mt-8 flex items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-100/85">
          <Lock className="h-4 w-4 shrink-0" />
          {state.lockedReason}
        </div>
      )}

      <div className="animate-fade-up mt-10 space-y-10">
        {groups.map((g, gi) => (
          <section key={`${g.section ?? "sem-seccao"}-${gi}`}>
            {g.section && (
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9834F]">
                {g.section}
              </h2>
            )}
            <div className="space-y-4">
              {g.modules.map((m) => (
                <ModuleCard
                  key={m.module.id}
                  state={m}
                  trackSlug={slug}
                  index={orderIndex.get(m.module.id) ?? 1}
                  isNext={m.module.id === currentModuleId}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

function ModuleCard({
  state,
  trackSlug,
  index,
  isNext,
}: {
  state: ModuleState;
  trackSlug: string;
  index: number;
  isNext: boolean;
}) {
  const locked = state.status === "locked";
  const { module } = state;

  return (
    <div
      className={`rounded-2xl border bg-white/[0.025] p-5 transition ${
        isNext
          ? "border-[#783DF5]/40 shadow-[0_10px_40px_-24px_rgba(120,61,245,0.8)]"
          : "border-white/10"
      } ${locked ? "opacity-60" : ""}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${
              state.status === "completed"
                ? "bg-emerald-500/15 text-emerald-300"
                : locked
                  ? "bg-white/[0.05] text-white/35"
                  : "brand-gradient-bg text-white"
            }`}
          >
            {state.status === "completed" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : locked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              index
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold text-white">
                {module.title}
              </h3>
              {isNext && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#A9834F]/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[#d8b98a]">
                  <Sparkles className="h-2.5 w-2.5" />
                  Onde estás
                </span>
              )}
            </div>
            {module.description && (
              <p className="mt-1 text-[12.5px] leading-relaxed text-white/50">
                {module.description}
              </p>
            )}
          </div>
        </div>
        <ModuleStatusChip
          status={state.status}
          percent={state.percent}
          hasContent={state.hasContent}
        />
      </header>

      <div className="mt-4">
        <ProgressBar percent={state.percent} />
        <p className="mt-1.5 text-[11px] text-white/40">
          {state.watchedLessons}/{state.totalLessons} aulas
          {state.missingVideos > 0 && (
            <span className="text-amber-200/60">
              {" "}
              · {state.missingVideos} por gravar
            </span>
          )}
          {state.quizRequired && (
            <span>
              {" "}
              ·{" "}
              {state.quizPassed
                ? `teste passado${state.quizBestScore !== null ? ` (${state.quizBestScore}%)` : ""}`
                : "teste por fazer"}
            </span>
          )}
        </p>
      </div>

      {!locked && (
        <ul className="mt-4 space-y-1.5">
          {state.lessons.map((l) => (
            <li key={l.lesson.id}>
              <Link
                href={`/formacao/${trackSlug}/aula/${l.lesson.id}`}
                className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 transition hover:border-[#783DF5]/30 hover:bg-white/[0.05]"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    l.watched
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-white/[0.05] text-white/40"
                  }`}
                >
                  {l.watched ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <PlayCircle className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-white/85">
                      {l.lesson.title}
                    </span>
                    <LessonTypeBadge type={l.lesson.type} />
                    {l.comingSoon && (
                      <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white/45">
                        Brevemente
                      </span>
                    )}
                  </span>
                  {!l.watched && !l.comingSoon && l.percent > 0 && (
                    <span className="mt-0.5 block text-[11px] text-white/40">
                      {l.percent}% visto
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-white/35">
                  ~{lessonMinutes(l.lesson)} min
                </span>
              </Link>
            </li>
          ))}

          {state.quizRequired && (
            <li>
              <Link
                href={`/formacao/${trackSlug}/teste/${module.id}`}
                className="group flex items-center gap-3 rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-3 py-2.5 transition hover:border-[#783DF5]/35 hover:bg-white/[0.05]"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    state.quizPassed
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-white/[0.05] text-white/40"
                  }`}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-medium text-white/85">
                  {module.quiz.title}
                  <span className="ml-2 text-[11px] font-normal text-white/40">
                    mínimo {module.quiz.passingScore}%
                    {state.quizAttempts > 0 &&
                      ` · ${state.quizAttempts} tentativa${state.quizAttempts === 1 ? "" : "s"}`}
                  </span>
                </span>
                {state.quizPassed && state.quizBestScore !== null && (
                  <span className="shrink-0 text-[11px] font-semibold text-emerald-300">
                    {state.quizBestScore}%
                  </span>
                )}
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
