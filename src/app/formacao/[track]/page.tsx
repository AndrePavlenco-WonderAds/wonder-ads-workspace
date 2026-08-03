// Roadmap de uma trilha.
//
// Desenho decalcado do hub de onboarding de clientes (hero + anel, rail
// vertical numerado, cartões encostados ao rail, barra fixa ao fazer scroll),
// traduzido para o tema escuro do workspace. Cada módulo é uma estação do
// percurso; a última paragem de cada estação é o teste.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Film,
  Lock,
  PartyPopper,
  Sparkles,
  UserRound,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TrainingStickyBar } from "@/components/training/training-sticky-bar";
import {
  LessonThumb,
  LessonTypeBadge,
  ModuleStatusChip,
  ProgressBar,
  ProgressRing,
  StatTile,
} from "@/components/training/training-ui";
import { getTrainingContext, trackStateFor } from "@/lib/training/server";
import { lessonMinutes } from "@/lib/training/catalog";
import type { ModuleState, TrackState } from "@/lib/training/progress";

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

  // Só se abre uma trilha em que o utilizador está inscrito — a especialização
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

  const currentModuleId =
    state.modules.find((m) => m.status === "in_progress")?.module.id ?? null;
  const orderIndex = new Map(
    state.modules.map((m, i) => [m.module.id, i + 1] as const),
  );

  const quizzesTotal = state.modules.filter((m) => m.quizRequired).length;
  const quizzesPassed = state.modules.filter(
    (m) => m.quizRequired && m.quizPassed,
  ).length;
  const modulesDone = state.modules.filter(
    (m) => m.status === "completed" && m.hasContent,
  ).length;

  // "Concluída" exige que não falte nada por gravar. Com aulas ainda por
  // gravar o que a pessoa está é EM DIA — dizer-lhe que acabou seria mentir
  // sobre o que ainda vem.
  const fullyDone = state.completed && state.hasContent && state.missingVideos === 0;
  const upToDate = state.completed && state.hasContent && !fullyDone;

  const nextHref = state.nextLesson
    ? `/formacao/${slug}/aula/${state.nextLesson.lesson.id}`
    : state.nextQuizModule
      ? `/formacao/${slug}/teste/${state.nextQuizModule.id}`
      : null;

  return (
    <PageShell backHref="/formacao" backLabel="Formação">
      {state.hasContent && !state.lockedReason && (
        <TrainingStickyBar
          title={state.track.name}
          percent={state.percent}
          done={state.watchedLessons + quizzesPassed}
          total={state.totalLessons + quizzesTotal}
          minutesLeft={state.minutesLeft}
          nextHref={nextHref}
          continueLabel={state.watchedLessons === 0 ? "Começar" : "Continuar"}
          allDone={state.completed}
          allDoneLabel={fullyDone ? "Trilha concluída" : "Em dia — falta gravar"}
        />
      )}

      {/* ===== Hero ===== */}
      <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md sm:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--brand-gradient)" }}
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
                <BookOpen className="h-3 w-3 text-[color:var(--brand-purple)]" />
                {state.track.isCommon ? "Categoria comum" : "Especialização"}
              </span>
              {fullyDone && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/85">
                  <PartyPopper className="h-3 w-3" />
                  Concluída
                </span>
              )}
              {upToDate && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/70">
                  <CheckCircle2 className="h-3 w-3" />
                  Em dia
                </span>
              )}
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-[2.5rem]">
              <span className="brand-gradient-text">{state.track.name}</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              {state.track.description}
            </p>

            {nextHref && !state.lockedReason && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={nextHref}
                  className="brand-gradient-bg group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-semibold text-white shadow-[0_12px_36px_-14px_rgba(120,61,245,0.8)] transition hover:brightness-110"
                >
                  {state.watchedLessons === 0
                    ? "Começar a trilha"
                    : "Continuar onde ficaste"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                {state.nextLesson && (
                  <Link
                    href={nextHref}
                    className="group inline-flex min-w-0 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-[#783DF5]/35 hover:bg-white/[0.06]"
                  >
                    <LessonThumb
                      type={state.nextLesson.lesson.type}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#A9834F]">
                        A seguir
                      </span>
                      <span className="block max-w-[220px] truncate text-[12.5px] font-medium text-white/80">
                        {state.nextLesson.lesson.title}
                      </span>
                    </span>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-6">
            <ProgressRing percent={state.percent} label="da trilha" size={132} />
          </div>
        </div>

        {/* Linha de estatísticas */}
        <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Aulas vistas"
            value={`${state.watchedLessons}/${state.totalLessons}`}
            icon={<Film className="h-3 w-3" />}
          />
          <StatTile
            label="Testes"
            value={`${quizzesPassed}/${quizzesTotal}`}
            icon={<ClipboardCheck className="h-3 w-3" />}
          />
          <StatTile
            label="Módulos"
            value={`${modulesDone}/${state.modules.length}`}
            icon={<BookOpen className="h-3 w-3" />}
          />
          {state.missingVideos > 0 ? (
            <StatTile
              label="Por gravar"
              value={state.missingVideos}
              hint="não bloqueiam"
              tone="warn"
              icon={<Clock className="h-3 w-3" />}
            />
          ) : (
            <StatTile
              label="Tempo restante"
              value={
                state.minutesLeft >= 60
                  ? `${Math.floor(state.minutesLeft / 60)}h${state.minutesLeft % 60 ? ` ${state.minutesLeft % 60}m` : ""}`
                  : `${state.minutesLeft} min`
              }
              icon={<Clock className="h-3 w-3" />}
            />
          )}
        </div>
      </section>

      {state.lockedReason && (
        <div className="animate-fade-up mt-6 flex items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-100/85">
          <Lock className="h-4 w-4 shrink-0" />
          {state.lockedReason}
        </div>
      )}

      {/* ===== Roadmap ===== */}
      <div className="animate-fade-up mt-10">
        {groups.map((g, gi) => (
          <section key={`${g.section ?? "s"}-${gi}`} className="mb-2">
            {g.section && (
              <div className="mb-5 mt-4 flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9834F]">
                  {g.section}
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-[#A9834F]/30 to-transparent" />
              </div>
            )}
            {g.modules.map((m) => (
              <ModuleStation
                key={m.module.id}
                state={m}
                trackSlug={slug}
                index={orderIndex.get(m.module.id) ?? 1}
                isCurrent={m.module.id === currentModuleId}
                isLast={
                  orderIndex.get(m.module.id) === state.modules.length
                }
              />
            ))}
          </section>
        ))}
      </div>

      {fullyDone && <TrackCompleted state={state} />}
      {upToDate && <TrackUpToDate state={state} />}
    </PageShell>
  );
}

/** Uma estação do roadmap: nó numerado no rail + cartão do módulo. */
function ModuleStation({
  state,
  trackSlug,
  index,
  isCurrent,
  isLast,
}: {
  state: ModuleState;
  trackSlug: string;
  index: number;
  isCurrent: boolean;
  isLast: boolean;
}) {
  const locked = state.status === "locked";
  const { module } = state;
  const done = state.status === "completed" && state.hasContent;

  return (
    <div className="flex gap-4 sm:gap-5">
      {/* Rail */}
      <div className="relative flex w-9 shrink-0 flex-col items-center">
        {!isLast && (
          <span
            className={`absolute bottom-0 top-12 w-[2px] ${
              done ? "bg-emerald-400/25" : "bg-white/8"
            }`}
          />
        )}
        <span
          className={`relative z-10 mt-4 flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold transition ${
            isCurrent ? "ring-4 ring-[#783DF5]/20" : ""
          } ${
            done
              ? "bg-emerald-500/20 text-emerald-300"
              : locked
                ? "bg-white/[0.05] text-white/30"
                : !state.hasContent
                  ? "border border-amber-400/30 bg-amber-500/10 text-amber-200/80"
                  : "brand-gradient-bg text-white shadow-[0_8px_24px_-10px_rgba(120,61,245,0.9)]"
          }`}
        >
          {done ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : locked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            index
          )}
        </span>
      </div>

      {/* Cartão */}
      <div
        className={`mb-4 flex-1 rounded-2xl border p-5 transition ${
          isCurrent
            ? "border-[#783DF5]/40 bg-white/[0.045] shadow-[0_16px_50px_-30px_rgba(120,61,245,1)]"
            : "border-white/10 bg-white/[0.022]"
        } ${locked ? "opacity-55" : ""}`}
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15.5px] font-semibold text-white">
                {module.title}
              </h2>
              {isCurrent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#A9834F]/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[#d8b98a]">
                  <Sparkles className="h-2.5 w-2.5" />
                  Estás aqui
                </span>
              )}
            </div>
            {module.description && (
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-white/50">
                {module.description}
              </p>
            )}
          </div>
          <ModuleStatusChip
            status={state.status}
            percent={state.percent}
            hasContent={state.hasContent}
          />
        </header>

        <div className="mt-4 flex items-center gap-3">
          <ProgressBar percent={state.percent} />
          <span className="shrink-0 text-[11px] font-medium text-white/40">
            {state.watchedLessons}/{state.totalLessons}
          </span>
        </div>

        {locked ? (
          <p className="mt-4 inline-flex items-center gap-2 text-[12px] text-white/40">
            <Lock className="h-3.5 w-3.5" />
            Abre quando concluíres o módulo anterior.
          </p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {state.lessons.map((l) => (
              <li key={l.lesson.id}>
                <Link
                  href={`/formacao/${trackSlug}/aula/${l.lesson.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-2.5 transition hover:border-[#783DF5]/30 hover:bg-white/[0.055]"
                >
                  <LessonThumb
                    type={l.lesson.type}
                    watched={l.watched}
                    comingSoon={l.comingSoon}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[13.5px] font-medium ${
                          l.comingSoon ? "text-white/45" : "text-white/90"
                        }`}
                      >
                        {l.lesson.title}
                      </span>
                      <LessonTypeBadge type={l.lesson.type} />
                      {l.comingSoon && (
                        <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white/45">
                          Brevemente
                        </span>
                      )}
                      {l.manual && l.watched && (
                        <span
                          title="Conclusão confirmada manualmente (o Loom não permite medir)"
                          className="rounded-full border border-white/12 px-2 py-0.5 text-[9.5px] uppercase tracking-wide text-white/35"
                        >
                          manual
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-white/40">
                      {l.lesson.presenter ? (
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-2.5 w-2.5" />
                          {l.lesson.presenter}
                        </span>
                      ) : (
                        <span className="text-amber-200/50">
                          apresentador por atribuir
                        </span>
                      )}
                      <span>·</span>
                      <span>~{lessonMinutes(l.lesson)} min</span>
                      {!l.watched && l.percent > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[#c3aaff]">
                            {l.percent}% visto
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
                </Link>
              </li>
            ))}

            {/* Estação final do módulo: o teste. */}
            <li>
              {state.quizRequired ? (
                <Link
                  href={`/formacao/${trackSlug}/teste/${module.id}`}
                  className={`group flex items-center gap-3 rounded-xl border border-dashed p-2.5 transition ${
                    state.quizPassed
                      ? "border-emerald-400/25 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                      : "border-[#783DF5]/30 bg-[#783DF5]/[0.05] hover:border-[#783DF5]/50 hover:bg-[#783DF5]/10"
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                      state.quizPassed
                        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                        : "border-[#783DF5]/30 bg-[#783DF5]/10 text-[#c3aaff]"
                    }`}
                  >
                    <ClipboardCheck className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-white/90">
                      {module.quiz.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-white/40">
                      {module.quiz.questions.length} perguntas · mínimo{" "}
                      {module.quiz.passingScore}%
                      {state.quizAttempts > 0 &&
                        ` · ${state.quizAttempts} tentativa${state.quizAttempts === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  {state.quizPassed && state.quizBestScore !== null ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                      {state.quizBestScore}%
                    </span>
                  ) : (
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
                  )}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 p-2.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] text-white/25">
                    <ClipboardCheck className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-white/45">
                      {module.quiz.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-white/35">
                      {module.quiz.questions.length === 0
                        ? "Ainda sem perguntas — não bloqueia a progressão."
                        : `${module.quiz.questions.length} perguntas escritas — abre quando as aulas estiverem gravadas.`}
                    </span>
                  </span>
                </div>
              )}
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

/** Concluiu tudo o que existe, mas ainda falta conteúdo por gravar. */
function TrackUpToDate({ state }: { state: TrackState }) {
  return (
    <section className="animate-fade-up mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
        Estás em dia
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/55">
        Viste tudo o que já está gravado e passaste os testes disponíveis.
        Faltam {state.missingVideos} aulas por gravar — assim que forem
        publicadas aparecem aqui e voltas a ter trabalho para fazer.
      </p>
    </section>
  );
}

/** Ecrã de parabéns no fim da trilha. */
function TrackCompleted({ state }: { state: TrackState }) {
  return (
    <section className="animate-fade-up relative mt-6 overflow-hidden rounded-3xl border border-emerald-400/25 bg-emerald-500/[0.06] p-8 text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />
      <PartyPopper className="relative mx-auto h-9 w-9 text-emerald-300" />
      <h2 className="relative mt-3 text-2xl font-semibold tracking-tight text-white">
        Trilha concluída
      </h2>
      <p className="relative mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/60">
        Viste as {state.totalLessons} aulas de {state.track.name} e passaste os{" "}
        {state.modules.filter((m) => m.quizRequired).length} testes. Podes rever
        qualquer aula sempre que precisares.
      </p>
      <div className="relative mt-5 flex flex-wrap justify-center gap-3">
        <Link
          href="/formacao"
          className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110"
        >
          Voltar à Formação
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
