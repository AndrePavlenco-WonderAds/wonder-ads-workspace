// Public onboarding lesson/step page: breadcrumbs, video player, "SOBRE ESTE
// PASSO" rich content, mark-as-complete, and a right sidebar with the
// category's numbered steps + next-category button. No auth / no app chrome.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Check, PlayCircle, ArrowRight } from "lucide-react";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import { getOnboardingProgress } from "@/lib/onboarding-progress-store";
import {
  findLesson,
  findCategory,
  nextCategory,
  type Lesson,
} from "@/lib/onboarding-lessons";
import { getCourse } from "@/lib/onboarding-content-store";
import { OnboardingMarkComplete } from "@/components/onboarding-mark-complete";

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

export default async function OnboardingLessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  if (RESERVED.has(slug)) notFound();

  const categories = await getCourse();
  const lesson = findLesson(categories, lessonId);
  if (!lesson) notFound();
  // The form lesson has its own dedicated quiz page.
  if (lesson.kind === "form") redirect(`/${slug}/onboarding/form`);

  const client = await resolveOnboardingClient(slug);
  if (!client) notFound();

  const category = findCategory(categories, lesson.category);
  if (!category) notFound();

  const progress = await getOnboardingProgress(slug);
  const done = new Set(progress.completed);
  const isDone = done.has(lesson.id);

  const hubHref = `/${slug}/onboarding`;
  const nextCat = nextCategory(categories, lesson.id);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-[12px] text-black/45">
        <Link href={hubHref} className="hover:text-black/70">
          Onboarding PT
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={hubHref} className="hover:text-black/70">
          Categorias
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-black/55">{category.title}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-black/70">{lesson.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div>
          {/* Video player */}
          <div className="overflow-hidden rounded-2xl border border-black/8 bg-black shadow-sm">
            <div className="relative aspect-video w-full">
              {lesson.videoUrl ? (
                <iframe
                  src={lesson.videoUrl}
                  title={lesson.title}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <span className="text-4xl">{lesson.emoji}</span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-white/90">
                    <PlayCircle className="h-5 w-5" />
                    Vídeo em breve
                  </span>
                </div>
              )}
            </div>
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-black/85 sm:text-3xl">
            {lesson.title}
          </h1>

          {/* About */}
          <div className="mt-6 rounded-2xl border border-black/8 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#A9834F]">
              Sobre Este Passo
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-black/70">
              {lesson.about.map((block, i) => {
                if (block.type === "p") {
                  return <p key={i}>{block.text}</p>;
                }
                if (block.type === "bullets") {
                  return (
                    <div key={i}>
                      {block.intro && (
                        <p className="mb-1.5 font-medium text-black/75">
                          {block.intro}
                        </p>
                      )}
                      <ul className="ml-1 space-y-1.5">
                        {block.items.map((it, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#783DF5]" />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                // emails
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-[#783DF5]/15 bg-[#783DF5]/[0.04] p-4"
                  >
                    <p className="mb-2.5 font-medium text-black/75">
                      {block.intro}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {block.emails.map((email) => (
                        <a
                          key={email}
                          href={`mailto:${email}`}
                          className="rounded-lg border border-black/8 bg-white px-3 py-1.5 font-mono text-[12.5px] text-[#783DF5] shadow-sm transition hover:border-[#783DF5]/30"
                        >
                          {email}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-black/8 pt-5">
              <OnboardingMarkComplete
                slug={slug}
                lessonId={lesson.id}
                initialDone={isDone}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-10 lg:self-start">
          <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-black/85">
                {category.title}
              </h3>
              <span className="text-[11px] text-black/40">
                {category.lessons.length} lições
              </span>
            </div>
            <ol className="flex flex-col gap-1.5">
              {category.lessons.map((l, i) => {
                const active = l.id === lesson.id;
                const lDone = done.has(l.id);
                return (
                  <li key={l.id}>
                    <Link
                      href={lessonHref(slug, l)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-200 ${
                        active
                          ? "border-[#783DF5]/30 bg-[#783DF5]/[0.05]"
                          : "border-transparent hover:bg-black/[0.03]"
                      }`}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={
                          lDone
                            ? { background: BRAND_GRADIENT, color: "#fff" }
                            : active
                              ? { background: "rgba(120,61,245,0.15)", color: "#783DF5" }
                              : { background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.45)" }
                        }
                      >
                        {lDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span
                        className={`flex-1 truncate text-[13px] ${
                          active ? "font-semibold text-black/85" : "text-black/65"
                        }`}
                      >
                        {l.title}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>

            {nextCat && (
              <Link
                href={lessonHref(slug, nextCat.lessons[0])}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                style={{ background: BRAND_GRADIENT }}
              >
                Próxima Categoria
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {!nextCat && (
              <Link
                href={hubHref}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-black/12 px-4 py-2.5 text-sm font-semibold text-black/65 transition hover:bg-black/[0.03]"
              >
                Voltar ao início
              </Link>
            )}
          </div>

          {/* Instructor */}
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
      </div>
    </main>
  );
}
