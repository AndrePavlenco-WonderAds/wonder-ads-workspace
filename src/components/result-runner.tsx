"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Loader2,
  Square,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { ActionDef, ActionToolName } from "@/lib/seo-pillars";
import type { HistoryEntry } from "@/lib/action-history";
import { makeResultId } from "@/lib/action-history";
import { pendingKey } from "./action-runner";
import { MarkdownView } from "./markdown-view";
import { DomainDashboard } from "./domain-dashboard";

type Status = "loading" | "ready" | "generating" | "done" | "error" | "missing";

const SEPARATOR = "\n---\n\n";

export function ResultRunner({
  clientSlug,
  action,
  resultId,
  existing,
}: {
  clientSlug: string;
  action: ActionDef;
  resultId: string;
  existing: HistoryEntry | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isPrintMode = searchParams?.get("print") === "true";

  function regenerateWithSameInputs() {
    if (Object.keys(inputs).length === 0) return;
    const newId = makeResultId();
    try {
      sessionStorage.setItem(
        pendingKey(clientSlug, action.slug, newId),
        JSON.stringify(inputs),
      );
    } catch (err) {
      console.error("sessionStorage write failed:", err);
    }
    router.push(`/seo/${clientSlug}/actions/${action.slug}/results/${newId}`);
  }

  const [output, setOutput] = useState(existing?.output ?? "");
  const [inputs, setInputs] = useState<Record<string, string>>(
    existing?.inputs ?? {},
  );
  const [status, setStatus] = useState<Status>(
    existing ? "done" : "loading",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationStartedRef = useRef(false);
  const genPhaseStartedAtRef = useRef<number | null>(null);
  const [, setTick] = useState(0); // forces re-render for time-based progress

  const apiBase = useMemo(
    () => `/api/seo-actions/${clientSlug}/${action.slug}`,
    [clientSlug, action.slug],
  );

  const expectedToolSteps = useMemo(() => {
    if (action.slug === "seo-audit") return 7; // sitemap + crawl-home + crawl-sample + psi×2 + gsc + dataforseo
    return action.tools?.length ?? 0;
  }, [action.slug, action.tools]);

  // The result card should only show the analysis, not the tool-progress
  // blockquotes — those are transient build output. The separator (`---`)
  // emitted by the API marks the boundary.
  const analysisText = useMemo(() => {
    const sep = "\n---\n\n";
    const idx = output.indexOf(sep);
    if (idx >= 0) return output.slice(idx + sep.length);
    // No separator yet: if everything we have is progress blockquotes, treat
    // the analysis as empty (we're still in the tool phase).
    if (output.trim().startsWith(">")) return "";
    return output;
  }, [output]);

  // Auto-trigger print dialog in print mode once content is in.
  useEffect(() => {
    if (!isPrintMode) return;
    if (status !== "done") return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [isPrintMode, status]);

  // Stream one HTTP body into the local output buffer. Returns the accumulated
  // text + a flag so the caller can decide what to do on failure.
  const consumeStream = useCallback(
    async (res: Response, accStart: string): Promise<string> => {
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let acc = accStart;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const before = acc;
        acc += decoder.decode(value, { stream: true });
        if (
          genPhaseStartedAtRef.current === null &&
          acc.includes(SEPARATOR) &&
          !before.includes(SEPARATOR)
        ) {
          genPhaseStartedAtRef.current = Date.now();
        }
        setOutput(acc);
      }
      acc += decoder.decode();
      setOutput(acc);
      return acc;
    },
    [],
  );

  const startGeneration = useCallback(
    async (formInputs: Record<string, string>) => {
      if (generationStartedRef.current) return;
      generationStartedRef.current = true;
      setStatus("generating");
      setOutput("");
      setErrorMsg(null);
      setInputs(formInputs);

      const controller = new AbortController();
      abortRef.current = controller;

      async function callPhase(
        path: string,
        accStart: string,
      ): Promise<string> {
        const res = await fetch(`${apiBase}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ inputs: formInputs, resultId }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          let message = text || `HTTP ${res.status}`;
          try {
            const parsed = JSON.parse(text) as { error?: unknown };
            if (typeof parsed?.error === "string") message = parsed.error;
          } catch {
            /* not JSON */
          }
          throw new Error(message);
        }
        return consumeStream(res, accStart);
      }

      try {
        if (action.slug === "seo-audit") {
          // Two-phase: tools first (under 60s), then Claude (under 60s).
          // /prep saves the fact pack to KV before the stream closes;
          // /run picks it up + sends the `---` separator + streams Claude.
          const afterPrep = await callPhase("/prep", "");
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          await callPhase("/run", afterPrep);
        } else {
          // Single call for actions that comfortably fit under 60s.
          await callPhase("", "");
        }
        setStatus("done");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("ready");
          return;
        }
        console.error("generation failed:", err);
        setErrorMsg((err as Error).message || "Generation failed.");
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [apiBase, resultId, action.slug, consumeStream],
  );

  // On mount: if no existing result, check sessionStorage for pending inputs
  // and kick off generation. If neither, mark as missing.
  useEffect(() => {
    if (existing) return; // already rendered from KV
    let cancelled = false;
    const key = pendingKey(clientSlug, action.slug, resultId);
    const raw = sessionStorage.getItem(key);
    if (raw) {
      sessionStorage.removeItem(key);
      try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (!cancelled) startGeneration(parsed);
      } catch {
        if (!cancelled) setStatus("missing");
      }
    } else {
      if (!cancelled) setStatus("missing");
    }
    return () => {
      cancelled = true;
    };
  }, [existing, clientSlug, action.slug, resultId, startGeneration]);

  // Re-render every 500ms while generating so the time-based progress moves.
  useEffect(() => {
    if (status !== "generating") return;
    const i = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(i);
  }, [status]);

  function stop() {
    abortRef.current?.abort();
  }

  // Progress calculation
  const progress = useMemo(() => {
    if (status === "done") return 100;
    if (status === "missing" || status === "error") return 0;
    if (status === "loading" || status === "ready") return 5;

    // generating
    const toolDoneCount = countToolDone(output);
    if (expectedToolSteps > 0 && genPhaseStartedAtRef.current === null) {
      return Math.min(
        60,
        Math.round((toolDoneCount / expectedToolSteps) * 60),
      );
    }
    // gen phase
    const startedAt = genPhaseStartedAtRef.current ?? Date.now();
    const elapsed = (Date.now() - startedAt) / 1000;
    const genProgress = Math.min(35, (elapsed / 30) * 35);
    return 60 + Math.round(genProgress);
  }, [status, output, expectedToolSteps]);

  const stageLabel = useMemo(() => {
    if (status === "done") return "Done";
    if (status === "missing") return "No result yet";
    if (status === "error") return "Error";
    if (genPhaseStartedAtRef.current) return "SEO Claude is writing the analysis…";
    if (action.tools && action.tools.length > 0) {
      const toolNames: Record<ActionToolName, string> = {
        "crawl-page": "Page HTML",
        "pagespeed-mobile": "PSI Mobile",
        "pagespeed-desktop": "PSI Desktop",
        "sitemap-discovery": "Sitemap",
        "crawl-sample": "Sample crawl",
        "gsc-site-data": "Search Console",
        "dataforseo-domain": "DataforSEO",
      };
      const remaining = action.tools.filter(
        (t) => !output.includes(`> ✓ **${toolNames[t]}`),
      );
      return remaining.length === 0
        ? "Tools done — preparing analysis…"
        : `Running tools (${remaining.length} remaining)…`;
    }
    return "Generating…";
  }, [status, output, action.tools]);

  // ---- Print mode: minimal layout ----
  if (isPrintMode) {
    return (
      <div className="bg-white text-black">
        <style>{`
          @media print {
            @page { margin: 16mm 14mm; }
            .no-print { display: none !important; }
            h2 { break-before: page; }
            h2:first-of-type { break-before: avoid; }
            table { break-inside: avoid; }
          }
          html, body { background: white !important; }
          .print-doc { color: #1a1a1a; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
          .print-doc h1 { font-size: 24px; font-weight: 700; color: #0a0a0a; margin: 0 0 6px; }
          .print-doc h2 { font-size: 18px; font-weight: 700; color: #0a0a0a; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d4d4d4; }
          .print-doc h3 { font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 16px 0 6px; }
          .print-doc h4 { font-size: 13px; font-weight: 700; color: #1a1a1a; margin: 12px 0 4px; }
          .print-doc p, .print-doc li { font-size: 12px; line-height: 1.5; }
          .print-doc strong { font-weight: 700; color: #0a0a0a; }
          .print-doc a { color: #5b34c9; text-decoration: none; }
          .print-doc table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 11px; }
          .print-doc th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #1a1a1a; font-weight: 700; }
          .print-doc td { border-bottom: 1px solid #e5e5e5; padding: 6px 8px; vertical-align: top; }
          .print-doc pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; font-size: 10.5px; }
          .print-doc code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
          .print-doc blockquote { border-left: 3px solid #5b34c9; padding-left: 10px; color: #555; margin: 10px 0; }
          .print-meta { color: #777; font-size: 11px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
          .print-empty { color: #888; padding: 40px 0; text-align: center; }
        `}</style>
        <div className="print-doc mx-auto max-w-3xl p-6">
          {analysisText ? (
            <>
              <h1>{action.label}</h1>
              <div className="print-meta">
                {resultId} · generated{" "}
                {new Date().toLocaleString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <MarkdownView source={analysisText} />
            </>
          ) : (
            <div className="print-empty">
              <p>
                <strong>This result hasn&apos;t been saved yet.</strong>
              </p>
              <p>
                Wait for generation to finish in the original tab — once you see
                the &quot;Done&quot; status there, refresh this page.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Normal mode ----
  return (
    <div className="space-y-5">
      {/* Status / progress card */}
      {status !== "done" && (
        <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
          <header className="flex flex-wrap items-center gap-3">
            {status === "generating" ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/75" />
            ) : status === "error" ? (
              <AlertTriangle className="h-4 w-4 text-red-300" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            )}
            <span className="text-sm font-medium text-white/85">
              {stageLabel}
            </span>
            <span className="ml-auto text-xs font-mono text-white/55">
              {progress}%
            </span>
            {status === "generating" && (
              <button
                type="button"
                onClick={stop}
                className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/75 transition hover:border-white/30 hover:text-white"
              >
                <Square className="h-3 w-3" />
                Stop
              </button>
            )}
          </header>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="brand-gradient-bg h-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {errorMsg && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {errorMsg}
            </div>
          )}
          {status === "missing" && (
            <p className="mt-3 text-xs text-white/55">
              This result page hasn&apos;t been generated yet. Go back to the
              action and click <span className="text-white">Generate</span> — a
              new result page will be created for that run.
            </p>
          )}
        </article>
      )}

      {/* Domain dashboard (SEO Audit only) */}
      {action.slug === "seo-audit" && (
        <DomainDashboard metrics={existing?.metrics ?? null} />
      )}

      {/* Output */}
      <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
        <header className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-white">
            Result
          </h2>
          <span className="font-mono text-[11px] text-white/45">
            {resultId}
          </span>
          {Object.keys(inputs).length > 0 && (
            <details className="ml-auto text-[11px]">
              <summary className="cursor-pointer text-white/45 hover:text-white/75">
                Inputs
              </summary>
              <dl className="mt-2 min-w-[260px] max-w-[420px] space-y-1 rounded-lg border border-white/10 bg-white/[0.025] p-3">
                {Object.entries(inputs).map(([k, v]) =>
                  v && v.trim() ? (
                    <div key={k}>
                      <dt className="text-white/45">{k}</dt>
                      <dd className="whitespace-pre-wrap text-white/80">
                        {v}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </details>
          )}
          {output && (
            <div className="ml-auto flex items-center gap-2">
              {status === "done" && Object.keys(inputs).length > 0 && (
                <button
                  type="button"
                  onClick={regenerateWithSameInputs}
                  title="Run this exact audit again with the same inputs"
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/65 transition hover:border-white/25 hover:text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                  Re-generate
                </button>
              )}
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(output)}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/65 transition hover:border-white/25 hover:text-white"
              >
                Copy
              </button>
              {status === "done" ? (
                <a
                  href={`?print=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/65 transition hover:border-white/25 hover:text-white"
                >
                  <Download className="h-3 w-3" />
                  Download PDF
                </a>
              ) : (
                <span
                  title="Available once generation finishes (KV save needs to complete first)"
                  className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-white/8 bg-white/[0.02] px-2 py-1 text-[11px] text-white/30"
                >
                  <Download className="h-3 w-3" />
                  Download PDF (finishing…)
                </span>
              )}
            </div>
          )}
        </header>

        {analysisText ? (
          <MarkdownView source={analysisText} />
        ) : status === "generating" ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center text-xs text-white/40">
            Tools are running — SEO Claude will start writing the report once
            the live data is in.
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center text-xs text-white/40">
            No analysis yet.
          </div>
        )}
      </article>
    </div>
  );
}

function countToolDone(text: string): number {
  // Count successful ✓ + failed ❌ tool-progress markers emitted by the route.
  let count = 0;
  const lines = text.split("\n");
  for (const line of lines) {
    if (/^> ✓ \*\*/.test(line) || /^> ❌ \*\*/.test(line)) count++;
  }
  return count;
}
