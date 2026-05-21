// Public, read-only preview of a single GMB Posts batch.
//
// This is the URL the Pending Review table's "Doc link" points to for
// GMB Posts batches. Clients open it from their review email or from
// the public review table; they see the post cards (image + caption +
// CTA + target keywords) WITHOUT any editing chrome, any internal
// navigation, any other client's data, or any way to climb up the URL
// into the workspace app.
//
// Renders under the (public-review) route group so it inherits the
// minimal layout (no PageShell, no header nav, no back button) and
// the noindex/nofollow meta.

import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { getClientGeo } from "@/lib/client-geo";
import { getGmbResult, localizeCta } from "@/lib/gmb-posts-store";
import { formatDate } from "@/lib/dates";
import { pickLang, t, plural } from "@/lib/public-i18n";

export const dynamic = "force-dynamic";

export default async function PublicGmbPreviewPage({
  params,
}: {
  params: Promise<{ slug: string; resultId: string }>;
}) {
  const { slug, resultId } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();
  const result = await getGmbResult(slug, resultId);
  if (!result) notFound();
  const logo = getClientLogo(slug);
  const consultantEmail = getConsultantEmailForSlug(slug);
  const consultantName = getConsultantForSlug(slug);
  const languageCode = getClientGeo(slug).languageCode;
  const lang = pickLang(slug);
  const introHtml = t(lang, "gmbIntro", {
    linkOpen: `<a href="/${slug}/pendingreview" class="font-medium text-black/85 underline-offset-2 hover:underline">`,
    linkClose: "</a>",
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-8">
      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${client.title} logo`}
            className="h-12 w-12 rounded-lg border border-black/8 bg-white object-contain p-1"
          />
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ backgroundColor: "#dbeafe", color: "#1e40af" }}
            >
              {t(lang, "gmbBadge")}
            </span>
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ backgroundColor: "#e9d5ff", color: "#581c87" }}
            >
              SEO DPT
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-black/85 sm:text-3xl">
            {client.title}
          </h1>
          <p className="mt-1 text-xs text-black/55">
            {t(lang, "gmbStats", {
              n: result.posts.length,
              plural: plural(result.posts.length),
              date: formatDate(result.createdAt),
            })}
          </p>
        </div>
      </header>

      {/* Intro */}
      <p
        className="mb-6 max-w-2xl text-sm leading-relaxed text-black/65"
        dangerouslySetInnerHTML={{ __html: introHtml }}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {result.posts.map((post, i) => (
          <article
            key={post.id}
            className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
          >
            {/* Image */}
            <div className="relative aspect-square w-full bg-black/[0.04]">
              {post.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.imageUrl}
                  alt={`GMB post ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] text-black/35">
                  (no image)
                </div>
              )}
              <span
                className="absolute left-3 top-3 inline-flex items-center rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm"
              >
                {post.postType}
              </span>
            </div>
            {/* Body */}
            <div className="space-y-3 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-black/85">
                {post.caption}
              </p>
              {post.targetKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {post.targetKeywords.map((k) => (
                    <span
                      key={k}
                      className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.04] px-2 py-0.5 text-[10px] text-black/60"
                    >
                      🎯 {k}
                    </span>
                  ))}
                </div>
              )}
              {post.cta && post.ctaUrl && (
                <div className="pt-2">
                  <a
                    href={post.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-black/[0.04] px-3 py-1 text-xs font-medium text-black/85 transition hover:bg-black/[0.08]"
                  >
                    {localizeCta(post.cta, languageCode)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-black/8 pt-6 text-center text-[11px] text-black/45">
        <p>
          <span
            className="font-semibold"
            style={{
              background:
                "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            Wonder Ads
          </span>{" "}
          · {t(lang, "footerTagline")}
        </p>
        <p className="mt-1.5">
          {consultantName && consultantName !== "Unassigned" ? (
            <span
              dangerouslySetInnerHTML={{
                __html: t(lang, "footerQuestions", {
                  consultant: consultantName,
                  emailLink: `<a href="mailto:${consultantEmail}" class="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline">${consultantEmail}</a>`,
                }),
              }}
            />
          ) : (
            <span
              dangerouslySetInnerHTML={{
                __html: t(lang, "footerQuestionsNoName", {
                  emailLink: `<a href="mailto:${consultantEmail}" class="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline">${consultantEmail}</a>`,
                }),
              }}
            />
          )}
        </p>
      </footer>
    </main>
  );
}
