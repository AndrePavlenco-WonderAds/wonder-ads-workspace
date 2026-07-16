// Public onboarding hub — the "course" overview. Left: progress + instructor
// card. Right: categories with lesson rows. No auth / no app chrome.

import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, ArrowRight, FileText, PlayCircle, Flag } from "lucide-react";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import { getOnboardingProgress } from "@/lib/onboarding-progress-store";
import { flattenLessons, type Lesson } from "@/lib/onboarding-lessons";
import { getCourse } from "@/lib/onboarding-content-store";

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
  return lesson.kind === "form"
    ? `/${slug}/onboarding/form`
    : `/${slug}/onboarding/${lesson.id}`;
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

  const [progress, categories] = await Promise.all([
    getOnboardingProgress(slug),
    getCourse(),
  ]);
  const allLessons = flattenLessons(categories);
  const total = allLessons.length;
  const done = new Set(progress.completed);
  const completedCount = allLessons.filter((l) => done.has(l.id)).length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const firstLessonId = allLessons[0]?.id;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        {client.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.logo}
            alt={`${client.title} logo`}
            className="h-12 w-12 rounded-lg border border-black/8 bg-white object-contain p-1"
          />
        ) : (
          <span
            className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl"
            style={{ background: "rgba(120,61,245,0.1)" }}
          >
            {client.icon ?? "🚀"}
          </span>
        )}
        <div className="flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A9834F]">
            Onboarding · Wonder Ads
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black/85 sm:text-3xl">
            {client.title}
          </h1>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-10 lg:self-start">
          <div className="rounded-2xl border border-black/8 bg-white p-6 shadow-sm">
            <div className="flex items-baseline justify-between">
              <span
                className="text-4xl font-bold"
                style={{
                  background: BRAND_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                {completedCount}
                <span className="text-lg font-semibold text-black/30">
                  /{total}
                </span>
              </span>
              <span className="text-[11px] font-medium text-black/45">
                {pct}%
              </span>
            </div>
            <p className="mt-1 text-[13px] font-medium text-black/55">
              lições concluídas
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/8">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: BRAND_GRADIENT,
                  boxShadow: "0 0 12px -2px rgba(120,61,245,0.6)",
                }}
              />
            </div>
          </div>

          {/* Instructor card */}
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg"
              style={{ background: BRAND_GRADIENT }}
            >
              🦋
            </span>
            <div>
              <p className="text-sm font-semibold text-black/85">Wonder Ads</p>
              <p className="text-[12px] text-black/45">Onboarding · Instrutor</p>
            </div>
          </div>
        </aside>

        {/* Categories */}
        <div className="space-y-8">
          {categories.map((cat) => {
            const catDone = cat.lessons.filter((l) => done.has(l.id)).length;
            return (
              <section key={cat.key}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold text-black/85">
                    {cat.title}
                  </h2>
                  <span className="text-[12px] text-black/40">
                    {catDone} de {cat.lessons.length} lições
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {cat.lessons.map((lesson) => {
                    const isDone = done.has(lesson.id);
                    const isFirst = lesson.id === firstLessonId;
                    return (
                      <Link
                        key={lesson.id}
                        href={lessonHref(slug, lesson)}
                        className="group flex items-center gap-4 rounded-2xl border border-black/8 bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-[#783DF5]/30 hover:shadow-md"
                      >
                        {/* Thumbnail */}
                        <span
                          className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl text-2xl"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(52,62,215,0.12), rgba(197,53,201,0.12))",
                          }}
                        >
                          {lesson.emoji}
                          {isFirst && (
                            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                              Começar aqui
                            </span>
                          )}
                        </span>
                        {/* Body */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[15px] font-semibold text-black/85">
                              {lesson.title}
                            </p>
                            {lesson.kind === "form" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#783DF5]/10 px-2 py-0.5 text-[10px] font-semibold text-[#783DF5]">
                                <FileText className="h-3 w-3" />
                                Formulário
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[12.5px] text-black/50">
                            {lesson.summary}
                          </p>
                        </div>
                        {/* Status */}
                        {isDone ? (
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/12 text-black/30 transition-colors group-hover:border-[#783DF5]/40 group-hover:text-[#783DF5]">
                            {lesson.kind === "info" ? (
                              <Flag className="h-3.5 w-3.5" />
                            ) : lesson.kind === "form" ? (
                              <ArrowRight className="h-3.5 w-3.5" />
                            ) : (
                              <PlayCircle className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
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
