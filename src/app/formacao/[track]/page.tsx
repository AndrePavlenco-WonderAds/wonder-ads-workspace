// Roadmap de um módulo da Formação.
//
// DESENHO — "consola de sequência". O módulo é uma sequência de capítulos que
// disparam por ordem, e a página mostra isso literalmente: um condutor
// vertical à esquerda cujo troço entre dois capítulos está ACESO na medida
// exata do que já foi feito. Um troço cheio = capítulo concluído; o troço do
// capítulo atual está cheio até à percentagem real; à frente fica apagado.
//
// Esse condutor é o único elemento com brilho e o único com movimento (o halo
// do nó onde a pessoa está). Tudo o resto — cartões, listas, chips — fica
// deliberadamente quieto, para que o olho vá primeiro ao sítio certo: o
// próximo passo.
//
// Os números são tabulares (`.tabular`) para que 8% e 100% ocupem a mesma
// largura e as leituras não dancem ao atualizar.

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
  Play,
  UserRound,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TrainingStickyBar } from "@/components/training/training-sticky-bar";
import {
  LessonThumb,
  LessonTypeBadge,
  ModuleStatusChip,
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

/** Minutos em "1h 20m" / "45 min" — a leitura de tempo é sempre a mesma. */
function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m ? ` ${m}m` : ""}`;
  }
  return `${minutes} min`;
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ track: string }>;
}) {
  const { track: slug } = await params;
  const ctx = await getTrainingContext();
  if (!ctx) redirect(`/login?next=/formacao/${slug}`);

  // Só se abre um módulo em que o utilizador está inscrito — a especialização
  // de outro departamento devolve 404, não uma página vazia.
  const state = trackStateFor(ctx, slug);
  if (!state) notFound();

  // Agrupar capítulos consecutivos com a mesma secção (ex.: Service Delivery).
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

  // "Concluído" exige que não falte nada por publicar. Com aulas ainda por
  // gravar o que a pessoa está é EM DIA — dizer-lhe que acabou seria mentir
  // sobre o que ainda vem.
  const fullyDone =
    state.completed && state.hasContent && state.missingVideos === 0;
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
          allDoneLabel={
            fullyDone ? "Módulo concluído" : "Em dia — falta publicar"
          }
        />
      )}

      {/* ===================== Hero ===================== */}
      <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.022] p-6 sm:p-9">
        {/* Bloom de fundo — ancorado ao canto do anel, para o olho cair no
            número do progresso e não num sítio qualquer. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 h-[26rem] w-[26rem] rounded-full opacity-[0.18] blur-3xl"
          style={{ background: "var(--brand-gradient)" }}
        />
        {/* Fio de luz no topo — assina o cartão sem lhe pôr uma moldura. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(120,61,245,0.65), rgba(197,53,201,0.35), transparent)",
          }}
        />

        <div className="relative flex flex-col gap-9 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="readout text-white/35">
                {state.track.isCommon
                  ? "Módulo · obrigatório"
                  : "Módulo · especialização"}
              </span>
              {fullyDone && (
                <span className="readout inline-flex items-center gap-1.5 text-emerald-300/85">
                  <PartyPopper className="h-3 w-3" />
                  Concluído
                </span>
              )}
              {upToDate && (
                <span className="readout inline-flex items-center gap-1.5 text-emerald-300/70">
                  <CheckCircle2 className="h-3 w-3" />
                  Em dia
                </span>
              )}
            </div>

            <h1 className="mt-3 text-[2rem] font-bold leading-[1.05] tracking-[-0.02em] sm:text-[2.9rem]">
              <span className="brand-gradient-text">{state.track.name}</span>
            </h1>
            <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-white/50">
              {state.track.description}
            </p>

            {nextHref && !state.lockedReason && (
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href={nextHref}
                  className="brand-gradient-bg group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-semibold text-white shadow-[0_14px_40px_-16px_rgba(120,61,245,0.9)] transition hover:brightness-110"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {state.watchedLessons === 0
                    ? "Começar o módulo"
                    : "Continuar onde ficaste"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                {state.nextLesson && (
                  <Link
                    href={nextHref}
                    className="group inline-flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.02] px-3 py-2 transition hover:border-[#783DF5]/40 hover:bg-white/[0.05]"
                  >
                    <LessonThumb type={state.nextLesson.lesson.type} size="sm" />
                    <span className="min-w-0">
                      <span className="readout block text-white/30">
                        A seguir
                      </span>
                      <span className="mt-0.5 block max-w-[230px] truncate text-[12.5px] font-medium text-white/80">
                        {state.nextLesson.lesson.title}
                      </span>
                    </span>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 lg:pr-2">
            <ProgressRing percent={state.percent} label="do módulo" size={148} />
          </div>
        </div>

        {/* Telemetria */}
        <div className="relative mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Aulas vistas"
            value={`${state.watchedLessons}/${state.allLessons}`}
            icon={<Film className="h-3 w-3" />}
          />
          <StatTile
            label="Testes"
            value={`${quizzesPassed}/${quizzesTotal}`}
            icon={<ClipboardCheck className="h-3 w-3" />}
          />
          <StatTile
            label="Capítulos"
            value={`${modulesDone}/${state.modules.length}`}
            icon={<BookOpen className="h-3 w-3" />}
          />
          {state.missingVideos > 0 ? (
            <StatTile
              label="Brevemente"
              value={state.missingVideos}
              hint="não bloqueiam"
              tone="warn"
              icon={<Clock className="h-3 w-3" />}
            />
          ) : (
            <StatTile
              label="Tempo restante"
              value={formatMinutes(state.minutesLeft)}
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

      {/* ===================== Sequência ===================== */}
      <div className="animate-fade-up mt-12">
        <div className="mb-7 flex items-center gap-3">
          <span className="readout text-white/35">Sequência</span>
          <span className="tabular text-[10px] font-semibold text-white/25">
            {state.modules.length.toString().padStart(2, "0")} capítulos
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-white/12 to-transparent" />
        </div>

        {groups.map((g, gi) => (
          <section key={`${g.section ?? "s"}-${gi}`}>
            {g.section && (
              <div className="mb-5 ml-14 mt-6 flex items-center gap-3">
                <span className="readout text-[#d8b98a]">{g.section}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-[#A9834F]/25 to-transparent" />
              </div>
            )}
            {g.modules.map((m) => (
              <ModuleStation
                key={m.module.id}
                state={m}
                trackSlug={slug}
                index={orderIndex.get(m.module.id) ?? 1}
                isCurrent={m.module.id === currentModuleId}
                isLast={orderIndex.get(m.module.id) === state.modules.length}
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

/** Uma estação da sequência: nó no condutor + cartão do capítulo. */
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

  // Quanto do troço até ao capítulo seguinte está aceso. Concluído acende
  // tudo; o capítulo atual acende na medida exata do que já foi feito.
  const conduitFill = done ? 100 : isCurrent ? state.percent : 0;

  return (
    <div className="flex gap-4 sm:gap-6">
      {/* ---- Condutor ---- */}
      <div className="relative flex w-10 shrink-0 flex-col items-center">
        {!isLast && (
          <span className="absolute bottom-0 left-1/2 top-[3.25rem] w-[2px] -translate-x-1/2 overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className="block w-full rounded-full transition-[height] duration-700"
              style={{
                height: `${conduitFill}%`,
                background: "var(--brand-gradient)",
                opacity: done ? 0.75 : 0.95,
              }}
            />
          </span>
        )}
        <span
          className={`tabular relative z-10 mt-5 flex h-10 w-10 items-center justify-center rounded-xl text-[12.5px] font-bold transition ${
            isCurrent ? "animate-node-halo" : ""
          } ${
            done
              ? "border border-emerald-400/35 bg-emerald-500/[0.12] text-emerald-300"
              : locked
                ? "border border-white/[0.07] bg-white/[0.02] text-white/25"
                : !state.hasContent
                  ? "border border-amber-400/30 bg-amber-500/[0.08] text-amber-200/75"
                  : "brand-gradient-bg text-white shadow-[0_10px_28px_-10px_rgba(120,61,245,0.95)]"
          }`}
        >
          {done ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : locked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            index.toString().padStart(2, "0")
          )}
        </span>
      </div>

      {/* ---- Cartão do capítulo ---- */}
      <div
        className={`mb-5 flex-1 overflow-hidden rounded-2xl border transition ${
          isCurrent
            ? "border-[#783DF5]/35 bg-white/[0.04] shadow-[0_20px_60px_-38px_rgba(120,61,245,1)]"
            : "border-white/[0.07] bg-white/[0.015]"
        } ${locked ? "opacity-50" : ""}`}
      >
        {/* Medidor do capítulo — encostado ao topo do cartão, como uma régua
            de nível. Substitui a barra solta que existia a meio. */}
        <div className="h-[3px] w-full bg-white/[0.05]">
          <div
            className="brand-gradient-bg h-[3px] transition-all duration-700"
            style={{ width: `${state.percent}%` }}
          />
        </div>

        <div className="p-5 sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="readout text-white/28">
                  Capítulo {index.toString().padStart(2, "0")}
                </span>
                {isCurrent && (
                  <span className="readout text-[#d8b98a]">Estás aqui</span>
                )}
              </div>
              <h2 className="mt-1.5 text-[16px] font-semibold tracking-[-0.01em] text-white">
                {module.title}
              </h2>
              {module.description && (
                <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">
                  {module.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <ModuleStatusChip
                status={state.status}
                percent={state.percent}
                hasContent={state.hasContent}
              />
              <span className="tabular text-[11px] text-white/30">
                {state.watchedLessons}/{state.allLessons} aulas
                {state.minutesLeft > 0 && ` · ~${state.minutesLeft} min`}
              </span>
            </div>
          </header>

          {locked ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] text-white/40">
              <Lock className="h-3.5 w-3.5" />
              Abre quando concluíres o capítulo anterior.
            </p>
          ) : (
            <ul className="mt-5 space-y-1.5">
              {state.lessons.map((l) => (
                <li key={l.lesson.id}>
                  <Link
                    href={`/formacao/${trackSlug}/aula/${l.lesson.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-2.5 transition hover:border-[#783DF5]/35 hover:bg-white/[0.05]"
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
                            l.comingSoon ? "text-white/40" : "text-white/90"
                          }`}
                        >
                          {l.lesson.title}
                        </span>
                        <LessonTypeBadge type={l.lesson.type} />
                        {l.comingSoon && (
                          <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.07] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-amber-200/70">
                            Brevemente
                          </span>
                        )}
                        {l.manual && l.watched && (
                          <span
                            title="Conclusão confirmada manualmente (o Loom não permite medir)"
                            className="rounded-full border border-white/12 px-2 py-0.5 text-[9.5px] uppercase tracking-wide text-white/30"
                          >
                            manual
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-white/35">
                        {l.lesson.presenter ? (
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-2.5 w-2.5" />
                            {l.lesson.presenter}
                          </span>
                        ) : (
                          <span className="text-amber-200/45">
                            apresentador por atribuir
                          </span>
                        )}
                        <span>·</span>
                        <span className="tabular">
                          ~{lessonMinutes(l.lesson)} min
                        </span>
                        {!l.watched && l.percent > 0 && (
                          <>
                            <span>·</span>
                            <span className="tabular text-[#c3aaff]">
                              {l.percent}% visto
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
                  </Link>
                </li>
              ))}

              {/* Paragem final do capítulo: o teste. */}
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
                      <span className="readout block text-white/28">
                        Fim do capítulo
                      </span>
                      <span className="mt-0.5 block text-[13.5px] font-medium text-white/90">
                        {module.quiz.title}
                      </span>
                      <span className="tabular mt-0.5 block text-[11px] text-white/35">
                        {module.quiz.questions.length} perguntas · mínimo{" "}
                        {module.quiz.passingScore}%
                        {state.quizAttempts > 0 &&
                          ` · ${state.quizAttempts} tentativa${state.quizAttempts === 1 ? "" : "s"}`}
                      </span>
                    </span>
                    {state.quizPassed && state.quizBestScore !== null ? (
                      <span className="tabular shrink-0 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                        {state.quizBestScore}%
                      </span>
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
                    )}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/[0.08] p-2.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.015] text-white/20">
                      <ClipboardCheck className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-white/40">
                        {module.quiz.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-white/30">
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
    </div>
  );
}

/** Concluiu tudo o que existe, mas ainda falta conteúdo por publicar. */
function TrackUpToDate({ state }: { state: TrackState }) {
  return (
    <section className="animate-fade-up ml-0 mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.022] p-7 text-center sm:ml-16">
      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
        Estás em dia
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/50">
        Viste tudo o que já está publicado e passaste os testes disponíveis.
        Faltam {state.missingVideos} aulas por publicar — assim que ficarem
        prontas aparecem aqui e voltas a ter trabalho para fazer.
      </p>
    </section>
  );
}

/** Ecrã de parabéns no fim do módulo. */
function TrackCompleted({ state }: { state: TrackState }) {
  return (
    <section className="animate-fade-up relative ml-0 mt-4 overflow-hidden rounded-3xl border border-emerald-400/25 bg-emerald-500/[0.05] p-9 text-center sm:ml-16">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />
      <PartyPopper className="relative mx-auto h-9 w-9 text-emerald-300" />
      <h2 className="relative mt-3 text-2xl font-semibold tracking-tight text-white">
        Módulo concluído
      </h2>
      <p className="relative mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
        Viste as {state.totalLessons} aulas de {state.track.name} e passaste os{" "}
        {state.modules.filter((m) => m.quizRequired).length} testes. Podes rever
        qualquer aula sempre que precisares.
      </p>
      <div className="relative mt-6 flex flex-wrap justify-center gap-3">
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
