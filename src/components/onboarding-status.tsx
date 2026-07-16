// Internal team view of a client's onboarding, rendered on the SEO project
// page (dark chrome). Shows lesson progress, form-submission status + PDF,
// confirmed accesses, and a button to copy the client's public onboarding
// link to share by email.

import { FileText, ExternalLink, Check, Clock } from "lucide-react";
import { CopyPublicLinkButton } from "@/components/copy-public-link-button";
import { formatDate } from "@/lib/dates";
import { flattenLessons, courseForTracks } from "@/lib/onboarding-lessons";
import { getCourse } from "@/lib/onboarding-content-store";
import { getOnboardingProgress } from "@/lib/onboarding-progress-store";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import { servicesLabel } from "@/lib/onboarding-tracks";
import { getOnboardingIntake } from "@/lib/onboarding-intake-store";

export async function OnboardingStatus({
  slug,
}: {
  slug: string;
}) {
  const [progress, intake, fullCourse, client] = await Promise.all([
    getOnboardingProgress(slug),
    getOnboardingIntake(slug),
    getCourse(),
    resolveOnboardingClient(slug),
  ]);
  const tracks = client?.tracks ?? ["seo"];
  const categories = courseForTracks(fullCourse, tracks);
  const allLessons = flattenLessons(categories);
  const total = allLessons.length;
  const done = new Set(progress.completed);
  const completedCount = allLessons.filter((l) => done.has(l.id)).length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;

  // Access lessons across SEO + Ads access categories.
  const accessLessons = categories
    .filter((c) => c.key.startsWith("acessos"))
    .flatMap((c) => c.lessons);
  const confirmedAccesses = accessLessons.filter((l) => done.has(l.id)).length;
  const totalAccesses = accessLessons.length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="brand-gradient-bg flex h-9 w-9 items-center justify-center rounded-lg shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]">
            <span className="text-base">🚀</span>
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Onboarding do Cliente
            </h2>
            <p className="text-[11px] text-white/45">
              {servicesLabel(client?.services ?? ["seo"])} · {completedCount} de{" "}
              {total} passos · {confirmedAccesses}/{totalAccesses} acessos
            </p>
          </div>
        </div>
        <CopyPublicLinkButton path={`/${slug}/onboarding`} />
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="brand-gradient-bg h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Form submission */}
      <div className="mb-5">
        {intake ? (
          <a
            href={intake.pdfUrl ?? "#"}
            target={intake.pdfUrl ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 transition hover:border-white/25 hover:bg-white/[0.05]"
          >
            <span className="brand-gradient-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]">
              <FileText className="h-5 w-5 text-white" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium text-white">
                  Formulário de Onboarding
                </p>
                {intake.pdfUrl && (
                  <ExternalLink className="h-3 w-3 shrink-0 text-white/40 transition group-hover:text-white/70" />
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-white/45">
                Submetido em {formatDate(intake.submittedAt)}
                {intake.pdfUrl ? " · Abrir PDF das respostas" : " · PDF a gerar…"}
              </p>
            </div>
          </a>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-3 text-[13px] text-white/50">
            <Clock className="h-4 w-4 text-white/35" />
            Formulário ainda não submetido pelo cliente.
          </div>
        )}
      </div>

      {/* Lesson checklist */}
      <div className="grid gap-4 sm:grid-cols-3">
        {categories.map((cat) => (
          <div key={cat.key}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              {cat.title}
            </p>
            <ul className="flex flex-col gap-1.5">
              {cat.lessons.map((l) => {
                const lDone = done.has(l.id);
                return (
                  <li
                    key={l.id}
                    className="flex items-center gap-2 text-[12.5px]"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        lDone ? "brand-gradient-bg" : "border border-white/15"
                      }`}
                    >
                      {lDone && (
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                      )}
                    </span>
                    <span className={lDone ? "text-white/80" : "text-white/45"}>
                      {l.title}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
