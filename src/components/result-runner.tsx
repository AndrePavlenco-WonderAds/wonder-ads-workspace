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
import type { DomainMetrics } from "@/lib/seo-tools/dataforseo";
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
  // Live metrics that appear as soon as Phase 1 saves the prep, so the
  // dashboard populates while Claude is still writing the analysis.
  const [liveMetrics, setLiveMetrics] = useState<DomainMetrics | null>(
    existing?.metrics ?? null,
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
          // Three-phase split so each fits inside Vercel's 60s function
          // budget on Hobby:
          //   /prep            — sitemap + crawl + PSI + GSC
          //   /prep-dataforseo — DataforSEO Labs + LLM Mentions
          //   /run             — Claude streams the analysis
          const afterPrep = await callPhase("/prep", "");
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          const afterPrepDfs = await callPhase("/prep-dataforseo", afterPrep);
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          // Phase 2 saved the metrics — fetch so the dashboard renders
          // alongside Claude's analysis instead of waiting for /save.
          fetch(
            `${apiBase}/prep-data?resultId=${encodeURIComponent(resultId)}`,
            { cache: "no-store" },
          )
            .then((r) => r.json())
            .then((j: { status?: string; metrics?: DomainMetrics | null }) => {
              if (j?.status === "ok" && j.metrics) setLiveMetrics(j.metrics);
            })
            .catch(() => {
              /* non-fatal — /save will return them too */
            });
          finalAcc = await callPhase("/run", afterPrepDfs);
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
                };
                if (saveJson?.metrics) setLiveMetrics(saveJson.metrics);
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

  // ---- Print mode: light layout with dashboard + analysis ----
  if (isPrintMode) {
    return (
      <div className="bg-white text-black">
        <style>{`
          @media print {
            @page { margin: 14mm 12mm; }
            .no-print { display: none !important; }
            h2 { break-before: page; }
            h2:first-of-type { break-before: avoid; }
            table { break-inside: avoid; }
            .pdf-stat { break-inside: avoid; }
          }
          html, body { background: white !important; color: #0a0a0a !important; }
          .pdf-doc { color: #1a1a1a; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
          .pdf-doc h1 { font-size: 26px; font-weight: 700; color: #0a0a0a; margin: 0 0 4px; }
          .pdf-doc h2 { font-size: 17px; font-weight: 700; color: #0a0a0a; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d4d4d4; }
          .pdf-doc h3 { font-size: 13.5px; font-weight: 700; color: #1a1a1a; margin: 14px 0 6px; }
          .pdf-doc h4 { font-size: 12.5px; font-weight: 700; color: #1a1a1a; margin: 12px 0 4px; }
          .pdf-doc p, .pdf-doc li { font-size: 11.5px; line-height: 1.55; }
          .pdf-doc strong { font-weight: 700; color: #0a0a0a; }
          .pdf-doc a { color: #5b34c9; text-decoration: none; }
          .pdf-doc table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 10.5px; }
          .pdf-doc th { text-align: left; padding: 5px 6px; border-bottom: 2px solid #1a1a1a; font-weight: 700; }
          .pdf-doc td { border-bottom: 1px solid #e5e5e5; padding: 5px 6px; vertical-align: top; }
          .pdf-doc pre { background: #f5f5f5; padding: 9px; border-radius: 4px; overflow: auto; font-size: 10px; }
          .pdf-doc code { background: #f0f0f0; padding: 1px 3px; border-radius: 3px; font-size: 10.5px; }
          .pdf-doc blockquote { border-left: 3px solid #5b34c9; padding-left: 10px; color: #555; margin: 10px 0; }
          .pdf-meta { color: #777; font-size: 11px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
          .pdf-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 14px; }
          .pdf-stat { border: 1px solid #d4d4d4; border-radius: 6px; padding: 8px 10px; }
          .pdf-stat-label { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #666; }
          .pdf-stat-value { font-size: 18px; font-weight: 700; color: #0a0a0a; margin-top: 2px; }
          .pdf-stat-sub { font-size: 9.5px; color: #888; margin-top: 2px; }
          .pdf-keywords { max-height: none !important; overflow: visible !important; }
          .pdf-empty { color: #888; padding: 40px 0; text-align: center; }
        `}</style>
        <div className="pdf-doc mx-auto max-w-3xl p-6">
          <h1>{action.label}</h1>
          <div className="pdf-meta">
            {resultId} · generated{" "}
            {new Date().toLocaleString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {liveMetrics &&
              ` · domain: ${liveMetrics.target} · ${liveMetrics.source}`}
          </div>

          {liveMetrics && action.slug === "seo-audit" && (
            <PrintDomainSummary metrics={liveMetrics} />
          )}

          {analysisText ? (
            <MarkdownView source={analysisText} />
          ) : (
            <div className="pdf-empty">
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
        <DomainDashboard
          metrics={liveMetrics}
          generating={status === "generating"}
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

function PrintDomainSummary({ metrics }: { metrics: DomainMetrics }) {
  const fmt = (v: number | null | undefined) =>
    v == null
      ? "—"
      : v < 1000
        ? v.toString()
        : v < 1_000_000
          ? `${(v / 1000).toFixed(1)}k`
          : `${(v / 1_000_000).toFixed(2)}M`;
  return (
    <>
      <h2>Domain intelligence</h2>
      <div className="pdf-stats">
        <div className="pdf-stat">
          <div className="pdf-stat-label">Authority</div>
          <div className="pdf-stat-value">
            {metrics.rankNormalised ?? "—"}
            {metrics.rankNormalised != null && <span style={{ fontSize: 11, color: "#888" }}>/100</span>}
          </div>
          {metrics.rank != null && (
            <div className="pdf-stat-sub">Rank {metrics.rank}</div>
          )}
        </div>
        <div className="pdf-stat">
          <div className="pdf-stat-label">Organic keywords</div>
          <div className="pdf-stat-value">{fmt(metrics.organicKeywords)}</div>
          {metrics.organicCount && (
            <div className="pdf-stat-sub">
              Top 3: {metrics.organicCount.top3} · Top 10: {metrics.organicCount.top10}
            </div>
          )}
        </div>
        <div className="pdf-stat">
          <div className="pdf-stat-label">Est. monthly traffic (ETV)</div>
          <div className="pdf-stat-value">
            {fmt(metrics.organicEtv != null ? Math.round(metrics.organicEtv) : null)}
          </div>
        </div>
        <div className="pdf-stat">
          <div className="pdf-stat-label">Referring domains</div>
          <div className="pdf-stat-value">{fmt(metrics.referringDomains)}</div>
          {metrics.backlinks != null && (
            <div className="pdf-stat-sub">{fmt(metrics.backlinks)} backlinks</div>
          )}
        </div>
      </div>

      {metrics.topKeywords && metrics.topKeywords.length > 0 && (
        <>
          <h3>Top ranked keywords ({metrics.topKeywords.length})</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Keyword</th>
                <th style={{ textAlign: "right" }}>Pos</th>
                <th style={{ textAlign: "right" }}>Volume</th>
                <th style={{ textAlign: "right" }}>ETV</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topKeywords.slice(0, 30).map((k, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{k.keyword}</td>
                  <td style={{ textAlign: "right" }}>{k.position}</td>
                  <td style={{ textAlign: "right" }}>{fmt(k.searchVolume)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(k.estTraffic != null ? Math.round(k.estTraffic * 10) / 10 : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
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
