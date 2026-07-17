// Public onboarding hub — the "course" overview. Premium redesign: a hero with
// a progress ring + "continue" CTA, a vertical timeline of categories/lessons
// with platform icons and roadmap (SEO/Ads) badges, and a sticky sidebar with
// the instructor + help. No auth / no app chrome.

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ArrowRight,
  FileText,
  PlayCircle,
  Flag,
  Sparkles,
  PartyPopper,
} from "lucide-react";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import { getOnboardingProgress } from "@/lib/onboarding-progress-store";
import { getGateConfirmedAt } from "@/lib/onboarding-gate-store";
import { getCourse } from "@/lib/onboarding-content-store";
import {
  flattenLessons,
  courseForTracks,
  lessonTrack,
  type Lesson,
} from "@/lib/onboarding-lessons";
import { PlatformIcon } from "@/components/platform-icon";
import { OnboardingInstructors } from "@/components/onboarding-instructors";
import { OnboardingGate } from "@/components/onboarding-gate";

export const dynamic = "force-dynamic";

const RESERVED = new Set([
  "seo",
  "ads",
  "web",
  "commercial",
  "changelog",
  "api",
  "review",
  "reviews",
  "survey",
  "_next",
  "static",
  "public",
]);

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

function lessonHref(slug: string, lesson: Lesson): string {
  return `/${slug}/onboarding/${lesson.id}`;
}

function TrackBadge({ track }: { track: "seo" | "ads" }) {
  const isSeo = track === "seo";
  return (
    <span
      title={isSeo ? "Roadmap SEO" : "Roadmap Ads"}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em]"
      style={{
        background: isSeo ? "rgba(120,61,245,0.1)" : "rgba(52,62,215,0.1)",
        color: isSeo ? "#783DF5" : "#343ED7",
      }}
    >
      {isSeo ? "SEO" : "Ads"}
    </span>
  );
}

function LessonThumb({ lesson }: { lesson: Lesson }) {
  if (lesson.platform) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-black/8 bg-white shadow-sm">
        <PlatformIcon platform={lesson.platform} className="h-8 w-8" />
      </span>
    );
  }
  return (
    <span
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl"
      style={{
        background:
          "linear-gradient(135deg, rgba(52,62,215,0.12), rgba(197,53,201,0.12))",
      }}
    >
      {lesson.emoji}
    </span>
  );
}

export default async function OnboardingHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (RESERVED.has(slug)) notFound();

  const client = await resolveOnboardingClient(slug);
  if (!client) notFound();

  const [progress, fullCourse, gateConfirmedAt] = await Promise.all([
    getOnboardingProgress(slug),
    getCourse(),
    getGateConfirmedAt(slug),
  ]);
  const categories = courseForTracks(fullCourse, {
    tracks: client.tracks,
    ecommerce: client.ecommerce,
    services: client.services,
  });
  const allLessons = flattenLessons(categories);
  const total = allLessons.length;
  const done = new Set(progress.completed);
  const completedCount = allLessons.filter((l) => done.has(l.id)).length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const allDone = total > 0 && completedCount === total;

  // Next incomplete lesson drives the "continue" CTA + the "current" highlight.
  const nextLesson = allLessons.find((l) => !done.has(l.id)) ?? null;

  // Progress ring geometry.
  const R = 46;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {!gateConfirmedAt && (
        <OnboardingGate slug={slug} clientTitle={client.title} />
      )}

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden rounded-3xl border border-black/8 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(120,61,245,0.35)] sm:p-9">
        {/* gradient glow */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-[0.12] blur-3xl"
          style={{ background: BRAND_GRADIENT }}
        />
        <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {client.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.logo}
                  alt={`${client.title} logo`}
                  className="h-11 w-11 rounded-xl border border-black/8 bg-white object-contain p-1"
                />
              ) : (
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                  style={{ background: "rgba(120,61,245,0.1)" }}
                >
                  {client.icon ?? "🚀"}
                </span>
              )}
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A9834F]">
                Onboarding · Wonder Ads
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-black/88 sm:text-[2.6rem]">
              {allDone ? "Tudo pronto," : "Bem-vindo,"}{" "}
              <span
                style={{
                  background: BRAND_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                {client.title}
              </span>
              {allDone ? " 🎉" : " 👋"}
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-black/55">
              {allDone
                ? "Concluiu todos os passos do onboarding. A nossa equipa já está a preparar a vossa estratégia."
                : "Este onboarding leva cerca de 30 minutos e dá-nos as bases e os acessos para tornarmos esta parceria a melhor e mais personalizada possível. O progresso é guardado automaticamente."}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {nextLesson ? (
                <Link
                  href={lessonHref(slug, nextLesson)}
                  className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#783DF5]/30 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                  style={{ background: BRAND_GRADIENT }}
                >
                  {completedCount === 0 ? "Começar agora" : "Continuar"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <span
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <PartyPopper className="h-4 w-4" />
                  Onboarding concluído
                </span>
              )}
              {nextLesson && (
                <span className="text-[13px] text-black/45">
                  A seguir:{" "}
                  <span className="font-medium text-black/70">
                    {nextLesson.title}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Progress ring */}
          <div className="flex shrink-0 flex-col items-center">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                <defs>
                  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#343ED7" />
                    <stop offset="0.55" stopColor="#783DF5" />
                    <stop offset="1" stopColor="#C535C9" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke="url(#ring)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${C}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-black/85">{pct}%</span>
                <span className="text-[11px] font-medium text-black/40">
                  {completedCount}/{total} passos
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Body ===== */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Timeline */}
        <div className="space-y-9">
          {categories.map((cat, ci) => {
            const catDone = cat.lessons.filter((l) => done.has(l.id)).length;
            const catPct = Math.round((catDone / cat.lessons.length) * 100);
            return (
              <section key={cat.key}>
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    {ci + 1}
                  </span>
                  <h2 className="text-lg font-semibold text-black/85">
                    {cat.title}
                  </h2>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/8">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${catPct}%`, background: BRAND_GRADIENT }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-black/45">
                      {catDone}/{cat.lessons.length}
                    </span>
                  </div>
                </div>

                <div className="relative">
                  {cat.lessons.map((lesson, li) => {
                    const isDone = done.has(lesson.id);
                    const isCurrent = nextLesson?.id === lesson.id;
                    const isLastInCat = li === cat.lessons.length - 1;
                    const track = lessonTrack(lesson);
                    return (
                      <div key={lesson.id} className="flex gap-4">
                        {/* Rail + node */}
                        <div className="relative flex w-8 shrink-0 flex-col items-center">
                          {!isLastInCat && (
                            <span className="absolute top-8 bottom-0 w-[2px] bg-black/8" />
                          )}
                          <span
                            className={`relative z-10 mt-6 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition ${
                              isCurrent ? "ring-4 ring-[#783DF5]/15" : ""
                            }`}
                            style={
                              isDone
                                ? { background: BRAND_GRADIENT, color: "#fff" }
                                : isCurrent
                                  ? { background: "#fff", color: "#783DF5", boxShadow: "inset 0 0 0 2px #783DF5" }
                                  : { background: "#eceae2", color: "rgba(0,0,0,0.4)" }
                            }
                          >
                            {isDone ? (
                              <Check className="h-4 w-4" strokeWidth={3} />
                            ) : (
                              li + 1
                            )}
                          </span>
                        </div>

                        {/* Card */}
                        <Link
                          href={lessonHref(slug, lesson)}
                          className={`group mb-3 flex flex-1 items-center gap-4 rounded-2xl border bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md ${
                            isCurrent
                              ? "border-[#783DF5]/40 shadow-[0_8px_30px_-16px_rgba(120,61,245,0.6)]"
                              : "border-black/8 hover:border-[#783DF5]/25"
                          }`}
                        >
                          <LessonThumb lesson={lesson} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[15px] font-semibold text-black/85">
                                {lesson.title}
                              </p>
                              {lesson.kind === "form" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#783DF5]/10 px-2 py-0.5 text-[10px] font-semibold text-[#783DF5]">
                                  <FileText className="h-3 w-3" />
                                  Formulário
                                </span>
                              )}
                              {(track === "seo" || track === "ads") && (
                                <TrackBadge track={track} />
                              )}
                              {isCurrent && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#A9834F]/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#A9834F]">
                                  <Sparkles className="h-3 w-3" />
                                  Próximo
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[12.5px] text-black/50">
                              {lesson.summary}
                            </p>
                          </div>
                          {isDone ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              Concluído
                            </span>
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/30 transition group-hover:border-[#783DF5]/40 group-hover:text-[#783DF5]">
                              {lesson.kind === "info" ? (
                                <Flag className="h-3.5 w-3.5" />
                              ) : lesson.kind === "form" ? (
                                <ArrowRight className="h-4 w-4" />
                              ) : (
                                <PlayCircle className="h-4 w-4" />
                              )}
                            </span>
                          )}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <OnboardingInstructors tracks={client.tracks} />

          {client.consultant && (
            <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A9834F]">
                Precisa de ajuda?
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-black/60">
                Fale com {client.consultant}, o seu consultor Wonder Ads —
                estamos a um email de distância.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">
              Progresso
            </p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span
                className="text-3xl font-bold"
                style={{
                  background: BRAND_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                {completedCount}
              </span>
              <span className="text-sm font-semibold text-black/35">
                / {total} passos
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/8">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: BRAND_GRADIENT }}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="mt-14 border-t border-black/8 pt-6 text-center text-[11px] text-black/45">
        <span
          className="font-semibold"
          style={{
            background: BRAND_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          Wonder Ads
        </span>
        {client.consultant && <> · {client.consultant}</>}
      </footer>
    </main>
  );
}
