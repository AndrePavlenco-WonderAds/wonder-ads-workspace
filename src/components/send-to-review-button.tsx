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
      className={
        state === "sent"
          ? "inline-flex items-center gap-1.5 rounded-md border border-emerald-400/45 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition"
          : state === "error"
            ? "inline-flex items-center gap-1.5 rounded-md border border-rose-400/45 bg-rose-500/15 px-3 py-1.5 text-[11px] font-semibold text-rose-100 transition"
            : "inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {state === "sending" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "sent" ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
      {state === "sent"
        ? "Sent to review"
        : state === "error"
          ? "Failed — retry"
          : "Send to Pending Review"}
    </button>
  );
}
