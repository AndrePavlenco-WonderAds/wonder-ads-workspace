"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import type { ActionDef, ActionToolName } from "@/lib/seo-pillars";
import type { HistoryEntry } from "@/lib/action-history";
import type { DomainMetrics } from "@/lib/seo-tools/dataforseo";
import type { SiteVitals } from "@/lib/audit-prep-store";
import type { KwResearchPack } from "@/lib/seo-tools/keyword-research";
import { pendingKey } from "./action-runner";
import { MarkdownView } from "./markdown-view";
import { DomainDashboard } from "./domain-dashboard";
import { KeywordResearchDashboard } from "./keyword-research-dashboard";

type Status = "loading" | "ready" | "generating" | "done" | "error" | "missing";

const SEPARATOR = "\n---\n\n";

export function ResultRunner({
  clientSlug,
  action,
  resultId,
  existing,
}: {
  clientSlug: string;
  clientName: string; // kept in the prop type for API stability; not used post print-mode extraction
  action: ActionDef;
  resultId: string;
  existing: HistoryEntry | null;
}) {
  const searchParams = useSearchParams();
  const isPrintMode = searchParams?.get("print") === "true";

  const [output, setOutput] = useState(existing?.output ?? "");
  const [inputs, setInputs] = useState<Record<string, string>>(
    existing?.inputs ?? {},
  );
  const [status, setStatus] = useState<Status>(
    existing ? "done" : "loading",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Live metrics that appear as soon as Phase 1 saves the prep, so the
  // dashboard populates while Claude is still writing the analysis.
  const [liveMetrics, setLiveMetrics] = useState<DomainMetrics | null>(
    existing?.metrics ?? null,
  );
  const [liveVitals, setLiveVitals] = useState<SiteVitals | null>(
    existing?.vitals ?? null,
  );
  const [liveKwPack, setLiveKwPack] = useState<KwResearchPack | null>(
    existing?.kwResearch ?? null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const generationStartedRef = useRef(false);
  const genPhaseStartedAtRef = useRef<number | null>(null);
  const [, setTick] = useState(0); // forces re-render for time-based progress

  const apiBase = useMemo(
    () => `/api/seo-actions/${clientSlug}/${action.slug}`,
    [clientSlug, action.slug],
  );

  const expectedToolSteps = useMemo(() => {
    // Phase 1 emits 6 done events (sitemap + crawl-home + crawl-sample +
    // psi mobile + psi desktop + GSC). Phase 2 emits 1 more (DataforSEO).
    if (action.slug === "seo-audit") return 7;
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
        let finalAcc: string;
        if (action.slug === "seo-audit") {
          // Four-phase split so each fits inside Vercel's 60s function
          // budget on Hobby:
          //   /prep            — sitemap + homepage crawl + sample crawl + GSC
          //   /prep-psi        — PageSpeed Insights mobile + desktop
          //   /prep-dataforseo — DataforSEO Labs + LLM Mentions
          //   /run             — Claude streams the analysis
          const afterPrep = await callPhase("/prep", "");
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          const afterPsi = await callPhase("/prep-psi", afterPrep);
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          const afterDfs = await callPhase("/prep-dataforseo", afterPsi);
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          // Phase 3 saved the metrics — fetch so the dashboard renders
          // alongside Claude's analysis instead of waiting for /save.
          fetch(
            `${apiBase}/prep-data?resultId=${encodeURIComponent(resultId)}`,
            { cache: "no-store" },
          )
            .then((r) => r.json())
            .then(
              (j: {
                status?: string;
                metrics?: DomainMetrics | null;
                vitals?: SiteVitals | null;
              }) => {
                if (j?.status === "ok") {
                  if (j.metrics) setLiveMetrics(j.metrics);
                  if (j.vitals) setLiveVitals(j.vitals);
                }
              },
            )
            .catch(() => {
              /* non-fatal — /save will return them too */
            });
          finalAcc = await callPhase("/run", afterDfs);
        } else {
          // Single call for actions that comfortably fit under 60s.
          finalAcc = await callPhase("", "");
        }

        // Persist the analysis. /run and the catch-all route no longer save
        // inline (Vercel was killing the function before the KV write could
        // complete). Save here as a quick separate request.
        const sep = SEPARATOR;
        const sepIdx = finalAcc.indexOf(sep);
        const analysis =
          sepIdx >= 0 ? finalAcc.slice(sepIdx + sep.length) : finalAcc;
        if (analysis.trim()) {
          try {
            const saveRes = await fetch(`${apiBase}/save`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                resultId,
                inputs: formInputs,
                output: analysis,
              }),
            });
            if (saveRes.ok) {
              try {
                const saveJson = (await saveRes.json()) as {
                  metrics?: DomainMetrics | null;
                  kwResearch?: KwResearchPack | null;
                };
                if (saveJson?.metrics) setLiveMetrics(saveJson.metrics);
                if (saveJson?.kwResearch) setLiveKwPack(saveJson.kwResearch);
              } catch {
                /* response body may not be JSON in edge cases */
              }
            }
          } catch (saveErr) {
            console.error("save failed:", saveErr);
            // Non-fatal — the user still sees the streamed output, just won't
            // survive a refresh. Surface a soft warning.
            setErrorMsg(
              "Generated successfully but couldn't persist to history. Refresh-survival isn't guaranteed.",
            );
          }
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

  // ?print=true is handled at the page level — it returns the branded
  // PrintLayout directly without PageShell. If we end up here in print
  // mode it means navigation raced; render nothing rather than the live
  // dashboard so the user doesn't see a flash of the dark UI.
  if (isPrintMode) {
    return null;
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
            {/* Stop removed — DataforSEO + PSI bills are already incurred
                once an audit starts, so 'stop' was misleading. Users can
                close the tab if they really want to walk away. */}
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
        <DomainDashboard
          metrics={liveMetrics}
          vitals={liveVitals}
          generating={status === "generating"}
        />
      )}

      {/* Keyword Research dashboard (Keyword Research only) */}
      {action.slug === "keyword-research" && (
        <KeywordResearchDashboard
          pack={liveKwPack}
          generating={status === "generating"}
          clientSlug={clientSlug}
          resultId={resultId}
        />
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
          {/* Download PDF lives at the top of the page now. Copy + Re-generate
              were removed per UX feedback — the result page is itself the
              persistent artefact. */}
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
