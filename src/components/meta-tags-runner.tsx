"use client";

// Meta Tags result-page driver. Handles the NDJSON stream from
// /meta-generate + renders the editable table once the result lands.

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { pendingKey } from "./action-runner";
import { MetaTagsTable } from "./meta-tags-table";
import type { ActionDef } from "@/lib/seo-pillars";
import type { MetaTagsResult } from "@/lib/meta-tags-store";

type Status = "loading" | "missing" | "generating" | "done" | "error";

type ProgressEvent = {
  event: "progress";
  phase: "context" | "kw" | "crawl" | "generate" | "saving";
  message: string;
};
type ResultEvent = { event: "result"; resultId: string; rowsCount: number };
type ErrorEvent = { event: "error"; message: string };
type MetaEvent = ProgressEvent | ResultEvent | ErrorEvent;

const PHASE_PERCENT: Record<ProgressEvent["phase"], number> = {
  context: 10,
  kw: 20,
  crawl: 45,
  generate: 80,
  saving: 95,
};

export function MetaTagsRunner({
  clientSlug,
  clientName,
  action,
  resultId,
  existing,
}: {
  clientSlug: string;
  clientName: string;
  action: ActionDef;
  resultId: string;
  existing: MetaTagsResult | null;
}) {
  const [status, setStatus] = useState<Status>(existing ? "done" : "loading");
  const [progressPct, setProgressPct] = useState(0);
  const [phaseMessage, setPhaseMessage] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<MetaTagsResult | null>(existing);
  const startedRef = useRef(false);
  const kickoffRef = useRef(false);

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
          `/api/seo-actions/${clientSlug}/${action.slug}/meta-generate`,
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
            /* not JSON */
          }
          throw new Error(msg);
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";
        let landedId: string | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let evt: MetaEvent | null = null;
            try {
              evt = JSON.parse(trimmed) as MetaEvent;
            } catch {
              continue;
            }
            if (evt.event === "progress") {
              setProgressPct((cur) => PHASE_PERCENT[evt.phase] ?? cur);
              setPhaseMessage(evt.message);
            } else if (evt.event === "error") {
              throw new Error(evt.message);
            } else if (evt.event === "result") {
              landedId = evt.resultId;
            }
          }
        }
        if (landedId) {
          // Fetch the saved result so we can render the table.
          const r = await fetch(
            `/api/seo-actions/${clientSlug}/${action.slug}/meta-result?id=${encodeURIComponent(landedId)}`,
            { cache: "no-store" },
          );
          if (r.ok) {
            const data = (await r.json()) as { result: MetaTagsResult };
            setResult(data.result);
            setProgressPct(100);
            setStatus("done");
          } else {
            setStatus("error");
            setErrorMsg(
              "Generation completed but the result couldn't be fetched. Refresh the page to view it.",
            );
          }
        } else {
          setStatus("error");
          setErrorMsg("Generation ended without a result event.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setStatus("error");
      }
    },
    [clientSlug, action.slug, resultId],
  );

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
                  ? phaseMessage || "Optimising meta tags…"
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
                Head back to{" "}
                <a
                  href={`/seo/${clientSlug}/actions/${action.slug}`}
                  className="text-white underline-offset-2 hover:underline"
                >
                  Meta Titles &amp; Descriptions
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
              {result.rows.length} page{result.rows.length === 1 ? "" : "s"}{" "}
              optimised for {clientName}
            </span>
            <span className="text-white/35">·</span>
            <span className="font-mono text-[11px] text-white/45">
              {result.id}
            </span>
            <span className="text-white/35">·</span>
            <span className="text-white/55">depth: {result.inputs.depth}</span>
            {result.stats.pagesWithMissingMeta > 0 && (
              <>
                <span className="text-white/35">·</span>
                <span className="text-amber-200">
                  ⚠️ {result.stats.pagesWithMissingMeta} page
                  {result.stats.pagesWithMissingMeta === 1 ? "" : "s"} were
                  missing meta descriptions
                </span>
              </>
            )}
            {result.stats.pagesWithLongTitle > 0 && (
              <>
                <span className="text-white/35">·</span>
                <span className="text-amber-200">
                  ⚠️ {result.stats.pagesWithLongTitle} title
                  {result.stats.pagesWithLongTitle === 1 ? "" : "s"} were too
                  long
                </span>
              </>
            )}
          </header>
          <MetaTagsTable
            clientSlug={clientSlug}
            resultId={result.id}
            initialRows={result.rows}
            readonly={false}
          />
        </section>
      )}
    </div>
  );
}
