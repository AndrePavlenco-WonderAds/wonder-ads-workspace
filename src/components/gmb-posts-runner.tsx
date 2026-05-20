"use client";

// GMB-specific result runner. The generic ResultRunner streams Claude
// text and persists a markdown artefact via /save; GMB's pipeline is
// different (Claude → captions JSON, Gemini → image bytes, separate KV
// store). Rather than overload ResultRunner, GMB lives in its own
// component with its own progress UX (real phase events from the
// NDJSON stream, not cycling fake messages).

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { pendingKey } from "./action-runner";
import { GmbPostCard } from "./gmb-post-card";
import type { ActionDef } from "@/lib/seo-pillars";
import type { GmbPost, GmbPostsResult } from "@/lib/gmb-posts-store";

type Status = "loading" | "missing" | "generating" | "done" | "error";

type ProgressEvent = {
  event: "progress";
  phase: "context" | "files" | "captions" | "images" | "saving";
  message: string;
  filesCount?: number;
  postsCount?: number;
};
type ResultEvent = { event: "result"; resultId: string; postsCount: number };
type ErrorEvent = { event: "error"; message: string };
type GmbEvent = ProgressEvent | ResultEvent | ErrorEvent;

const PHASE_PERCENT: Record<ProgressEvent["phase"], number> = {
  context: 10,
  files: 25,
  captions: 50,
  images: 80,
  saving: 95,
};

export function GmbPostsRunner({
  clientSlug,
  clientName,
  action,
  resultId,
  existing,
  languageCode,
}: {
  clientSlug: string;
  clientName: string;
  action: ActionDef;
  resultId: string;
  existing: GmbPostsResult | null;
  /** Client's language code from getClientGeo — drives CTA label localisation. */
  languageCode: string;
}) {
  const [status, setStatus] = useState<Status>(existing ? "done" : "loading");
  const [progressPct, setProgressPct] = useState(0);
  const [phaseMessage, setPhaseMessage] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<GmbPostsResult | null>(existing);
  const startedRef = useRef(false);

  const startGeneration = useCallback(
    async (formInputs: Record<string, string>) => {
      if (startedRef.current) return;
      startedRef.current = true;
      setStatus("generating");
      setProgressPct(5);
      setPhaseMessage("Starting…");
      setErrorMsg(null);
      try {
        const res = await fetch(
          `/api/seo-actions/${clientSlug}/${action.slug}/gmb-generate`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ inputs: formInputs, resultId }),
          },
        );
        if (!res.ok) {
          const text = await res.text();
          let msg = text || `HTTP ${res.status}`;
          try {
            const parsed = JSON.parse(text) as { error?: unknown };
            if (typeof parsed.error === "string") msg = parsed.error;
          } catch {
            /* not JSON — leave text as-is */
          }
          throw new Error(msg);
        }
        // Stream NDJSON: each line is one event.
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";
        let landed: GmbPostsResult | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let evt: GmbEvent | null = null;
            try {
              evt = JSON.parse(trimmed) as GmbEvent;
            } catch {
              continue;
            }
            if (evt.event === "progress") {
              setProgressPct((cur) => PHASE_PERCENT[evt.phase] ?? cur);
              setPhaseMessage(evt.message);
            } else if (evt.event === "error") {
              throw new Error(evt.message);
            } else if (evt.event === "result") {
              // Fetch the saved result so we can render the cards.
              try {
                const r = await fetch(
                  `/api/seo-actions/${clientSlug}/${action.slug}/gmb-result?id=${encodeURIComponent(evt.resultId)}`,
                  { cache: "no-store" },
                );
                if (r.ok) {
                  const data = (await r.json()) as {
                    result: GmbPostsResult;
                  };
                  landed = data.result;
                }
              } catch {
                /* fall through; user can refresh to load it */
              }
            }
          }
        }
        if (landed) {
          setResult(landed);
          setProgressPct(100);
          setStatus("done");
        } else {
          setStatus("error");
          setErrorMsg(
            "Generation completed but the result couldn't be fetched. Refresh the page to view it.",
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setStatus("error");
      }
    },
    [clientSlug, action.slug, resultId],
  );

  // Mount: if no existing, look for pending inputs and kick off ONCE.
  // The effect MUST be idempotent — Strict Mode double-fires in dev,
  // and `startGeneration`'s identity changes during the run (state
  // updates inside it), so this effect can re-fire multiple times. The
  // first run consumes sessionStorage; subsequent runs see it empty
  // and used to flip status to "missing" — which clobbered the
  // "generating" UI and produced the v71.1 "Nothing generated for this
  // URL" flash. Ref guard makes the consume side-effect-once.
  const kickoffRef = useRef(false);
  useEffect(() => {
    if (existing) return;
    if (kickoffRef.current) return;
    kickoffRef.current = true;
    const key = pendingKey(clientSlug, action.slug, resultId);
    const raw = sessionStorage.getItem(key);
    if (raw) {
      sessionStorage.removeItem(key);
      try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        void startGeneration(parsed);
      } catch {
        setStatus("missing");
      }
    } else {
      setStatus("missing");
    }
  }, [existing, clientSlug, action.slug, resultId, startGeneration]);

  return (
    <div className="space-y-5">
      {/* Progress card — visible during loading / generating / error /
          missing. Hidden the instant the result loads to remove the
          confusing "No result yet + 100%" overlap that v71.0 had. */}
      {!result &&
        (status === "generating" ||
          status === "loading" ||
          status === "missing" ||
          status === "error") && (
          <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
            <header className="flex items-center gap-3">
              {status === "generating" || status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin text-white/75" />
              ) : status === "error" ? (
                <AlertTriangle className="h-4 w-4 text-rose-300" />
              ) : (
                <Sparkles className="h-4 w-4 text-[color:var(--brand-purple)]" />
              )}
              <span className="text-sm font-medium text-white/85">
                {status === "generating"
                  ? phaseMessage || "Generating posts…"
                  : status === "error"
                    ? "Generation failed"
                    : status === "missing"
                      ? "Nothing generated for this URL"
                      : "Loading…"}
              </span>
              {status === "generating" && (
                <span className="ml-auto text-xs font-mono text-white/55">
                  {progressPct}%
                </span>
              )}
            </header>
            {status === "generating" && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="brand-gradient-bg h-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
            {errorMsg && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}
            {status === "missing" && (
              <p className="mt-3 text-xs text-white/55">
                This page was opened directly without a generation in flight.
                Head back to{" "}
                <a
                  href={`/seo/${clientSlug}/actions/${action.slug}`}
                  className="text-white underline-offset-2 hover:underline"
                >
                  GMB Posts Creation
                </a>{" "}
                and click <span className="text-white">Generate</span>.
              </p>
            )}
          </article>
        )}

      {result && (
        <section>
          <header className="mb-4 flex flex-wrap items-center gap-2 text-xs text-white/65">
            <Sparkles className="h-4 w-4 text-[color:var(--brand-purple)]" />
            <span className="font-medium text-white">
              {result.posts.length} GMB post
              {result.posts.length === 1 ? "" : "s"} for {clientName}
            </span>
            <span className="text-white/35">·</span>
            <span className="font-mono text-[11px] text-white/45">
              {result.id}
            </span>
            {result.inputs.theme && (
              <>
                <span className="text-white/35">·</span>
                <span className="text-white/55 italic">
                  &ldquo;{result.inputs.theme}&rdquo;
                </span>
              </>
            )}
          </header>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {result.posts.map((p, i) => (
              <GmbPostCard
                key={p.id}
                post={p}
                index={i}
                clientSlug={clientSlug}
                resultId={result.id}
                languageCode={languageCode}
                onSaved={(next: GmbPost) =>
                  setResult((prev) =>
                    prev
                      ? {
                          ...prev,
                          posts: prev.posts.map((q) =>
                            q.id === next.id ? next : q,
                          ),
                        }
                      : prev,
                  )
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
