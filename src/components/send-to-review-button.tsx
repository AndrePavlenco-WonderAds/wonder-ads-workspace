"use client";

// Universal "Send to Pending Review" button. Drop on any result page
// and it'll append a new row to that client's review table — task
// label + category + a doc link pointing back at the result page.

import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import type { ReviewCategory } from "@/lib/review-store";

export function SendToReviewButton({
  clientSlug,
  task,
  category,
  docLink,
  sourceType,
  variant = "default",
}: {
  clientSlug: string;
  task: string;
  category: ReviewCategory;
  /** External URL the review row should link to. Usually the result
   *  page (PDF for SEO Audit, KW dashboard for Keyword Research,
   *  GMB batch view for GMB Posts, etc.). When the docLink is a
   *  relative path it'll be resolved against the current origin
   *  client-side. */
  docLink?: string;
  /** Tag for the source-of-truth — surfaces on the internal table. */
  sourceType?: string;
  /** `default` = full prominent brand-gradient button for top-of-page
   *  use. `compact` = small icon-led button that fits in a row of
   *  other small actions (used by per-post buttons on GMB cards). */
  variant?: "default" | "compact" | "prominent";
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setErrorMsg(null);
    try {
      const resolvedDocLink =
        docLink && !/^https?:\/\//i.test(docLink) && typeof window !== "undefined"
          ? new URL(docLink, window.location.origin).toString()
          : docLink;
      const res = await fetch(`/api/reviews/${clientSlug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task,
          category,
          docLink: resolvedDocLink,
          sourceType,
          sourceUrl: resolvedDocLink,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setState("sent");
      setTimeout(() => setState("idle"), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const baseClasses =
    state === "sent"
      ? "inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-400/45 bg-emerald-500/15 text-emerald-100 transition"
      : state === "error"
        ? "inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-400/45 bg-rose-500/15 text-rose-100 transition"
        : variant === "prominent"
          ? "inline-flex items-center justify-center gap-2 rounded-md text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 hover:shadow-[#783DF5]/40 disabled:cursor-not-allowed disabled:opacity-50"
          : "inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const sizeClasses =
    variant === "compact"
      ? "px-2 py-1 text-[11px] font-medium"
      : variant === "prominent"
        ? "px-4 py-2 text-xs font-semibold"
        : "px-3 py-1.5 text-[11px] font-medium";
  const iconSize = variant === "compact" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={send}
      disabled={state === "sending" || state === "sent"}
      title={
        state === "error" && errorMsg
          ? errorMsg
          : "Add this to the client's Pending Review table so they can approve / reject."
      }
      className={`${baseClasses} ${sizeClasses}`}
      style={
        variant === "prominent" && state !== "sent" && state !== "error"
          ? {
              background:
                "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
            }
          : undefined
      }
    >
      {state === "sending" ? (
        <Loader2 className={`${iconSize} animate-spin`} />
      ) : state === "sent" ? (
        <Check className={iconSize} />
      ) : (
        <Send className={iconSize} />
      )}
      {variant === "compact" ? (
        state === "sent" ? "Sent" : state === "error" ? "Retry" : "Send"
      ) : state === "sent" ? (
        "Sent to review"
      ) : state === "error" ? (
        "Failed — retry"
      ) : (
        "Send to Pending Review"
      )}
    </button>
  );
}
