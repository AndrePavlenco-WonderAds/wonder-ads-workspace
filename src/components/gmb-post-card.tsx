"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Send,
  Sparkles,
} from "lucide-react";
import { SendToReviewButton } from "./send-to-review-button";
import {
  GMB_CTAS,
  GMB_POST_STATUSES,
  localizeCta,
  type GmbCta,
  type GmbPost,
  type GmbPostStatus,
} from "@/lib/gmb-posts-store";

const STATUS_META: Record<
  GmbPostStatus,
  { label: string; chipClass: string }
> = {
  draft: {
    label: "Draft",
    chipClass: "border-white/15 bg-white/[0.05] text-white/65",
  },
  approved: {
    label: "Approved",
    chipClass: "border-sky-400/40 bg-sky-500/15 text-sky-100",
  },
  published: {
    label: "Published",
    chipClass: "border-emerald-400/45 bg-emerald-500/15 text-emerald-100",
  },
};

export function GmbPostCard({
  post,
  index,
  clientSlug,
  resultId,
  languageCode,
  onSaved,
}: {
  post: GmbPost;
  index: number;
  clientSlug: string;
  resultId: string;
  /** Client's language for localizing the CTA button label. */
  languageCode: string;
  onSaved?: (next: GmbPost) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GmbPost>(post);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(post);
  }, [post]);

  async function persist(patch: Partial<GmbPost>) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/seo-actions/${clientSlug}/gmb-posts/gmb-update`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resultId, postId: post.id, patch }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        result: { posts: GmbPost[] };
      };
      const next = data.result.posts.find((p) => p.id === post.id);
      if (next) {
        setDraft(next);
        onSaved?.(next);
      }
    } catch (err) {
      console.error("gmb post save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(draft.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const meta = STATUS_META[draft.status];
  const charsLeft = 1500 - draft.caption.length;

  return (
    <article className="brand-gradient-border overflow-hidden rounded-2xl bg-white/[0.035] backdrop-blur-md">
      {/* Image */}
      <div className="relative aspect-square w-full bg-white/[0.04]">
        {draft.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.imageUrl}
            alt={`GMB post ${index + 1} for ${clientSlug}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-5 text-center text-xs text-white/55">
            <div>
              <Sparkles className="mx-auto h-5 w-5 text-rose-300" />
              <p className="mt-3 font-medium text-white/85">
                Image generation failed
              </p>
              {draft.imageError && (
                <p className="mt-1.5 select-text text-[10.5px] leading-snug text-rose-300/85">
                  {draft.imageError}
                </p>
              )}
              <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-white/40">
                caption is still usable
              </p>
            </div>
          </div>
        )}
        <span
          className={`absolute right-3 top-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.chipClass}`}
        >
          {meta.label}
        </span>
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
          {draft.postType}
        </span>
        {/* Image-source chip in the bottom-left of the image. Lets
            consultants tell at a glance whether they're looking at a
            real client photo or an AI-generated render. */}
        {draft.imageSource && (
          <span
            className={
              draft.imageSource === "client-files"
                ? "absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border border-emerald-400/45 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-50 backdrop-blur-sm"
                : "absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-purple)]/55 bg-[color:var(--brand-purple)]/25 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
            }
            title={
              draft.imageSource === "client-files"
                ? `Client photo from ${draft.imageOrigin ?? "the library"}`
                : "AI-generated image (Gemini)"
            }
          >
            {draft.imageSource === "client-files" ? "📸" : "✨"}
            {draft.imageSource === "client-files" ? "Client photo" : "AI image"}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="space-y-3 p-4">
        {editing ? (
          <>
            <textarea
              value={draft.caption}
              onChange={(e) =>
                setDraft({ ...draft, caption: e.target.value })
              }
              rows={6}
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            <div className="flex justify-between text-[10px] text-white/45">
              <span>{draft.caption.length} / 1500</span>
              {charsLeft < 0 && (
                <span className="text-rose-300">
                  {Math.abs(charsLeft)} over — trim before saving
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] uppercase tracking-[0.12em] text-white/45">
                CTA
                <select
                  value={draft.cta ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      cta: (e.target.value || null) as GmbCta,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-white focus:border-white/30"
                >
                  <option value="">No CTA</option>
                  {GMB_CTAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] uppercase tracking-[0.12em] text-white/45">
                Status
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.value as GmbPostStatus,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-white focus:border-white/30"
                >
                  {GMB_POST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-[10px] uppercase tracking-[0.12em] text-white/45">
              CTA URL
              <input
                type="text"
                value={draft.ctaUrl ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, ctaUrl: e.target.value || null })
                }
                placeholder="https://"
                className="mt-1 w-full rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-white outline-none focus:border-white/30"
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDraft(post);
                  setEditing(false);
                }}
                className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || charsLeft < 0}
                onClick={async () => {
                  await persist({
                    caption: draft.caption,
                    cta: draft.cta,
                    ctaUrl: draft.ctaUrl,
                    status: draft.status,
                  });
                  setEditing(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
              {draft.caption}
            </p>
            {draft.targetKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {draft.targetKeywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center rounded-full border border-[color:var(--brand-purple)]/35 bg-[color:var(--brand-purple)]/15 px-2 py-0.5 text-[10px] text-white/85"
                  >
                    🎯 {k}
                  </span>
                ))}
              </div>
            )}
            {draft.reasoning && (
              <p className="rounded-lg border-l-2 border-[color:var(--brand-purple)]/45 bg-white/[0.025] px-3 py-2 text-[11px] italic text-white/55">
                {draft.reasoning}
              </p>
            )}
            <div className="flex items-center justify-between border-t border-white/8 pt-3">
              <div className="flex items-center gap-2 text-[11px] text-white/55">
                {draft.cta && draft.ctaUrl ? (
                  <a
                    href={draft.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 font-medium text-white transition hover:bg-white/[0.12]"
                  >
                    {localizeCta(draft.cta, languageCode)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-white/35">No CTA</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {draft.imageUrl && (
                  <a
                    href={`/api/seo-actions/${clientSlug}/gmb-posts/gmb-download?resultId=${encodeURIComponent(resultId)}&postId=${encodeURIComponent(draft.id)}`}
                    title="Download this image"
                    className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] text-white/75 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
                  >
                    <Download className="h-3 w-3" />
                    Image
                  </a>
                )}
                <button
                  type="button"
                  onClick={copyCaption}
                  title="Copy caption to clipboard"
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] text-white/75 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] text-white/75 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                {/* Send THIS specific post (not the whole batch) to the
                    client's pending review table. Useful when the
                    consultant wants the client to OK one post but not
                    the others. */}
                <SendToReviewButton
                  variant="compact"
                  clientSlug={clientSlug}
                  task={`GMB ${draft.postType}: ${draft.caption.slice(0, 100)}${draft.caption.length > 100 ? "…" : ""}`}
                  category="GMB Posts"
                  docLink={`/${clientSlug}/preview/gmb-posts/${resultId}`}
                  sourceType={`gmb-post:${draft.id}`}
                />
                <button
                  type="button"
                  disabled
                  title="Direct publish to Google Business Profile is on the roadmap — for now download and post manually."
                  className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[11px] text-white/35"
                >
                  <Send className="h-3 w-3" />
                  Publish
                  <span className="ml-0.5 rounded-full border border-white/10 bg-white/[0.04] px-1 text-[8px] uppercase tracking-[0.12em] text-white/45">
                    soon
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
