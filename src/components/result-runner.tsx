"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Square, AlertTriangle } from "lucide-react";
import type { ActionDef, ActionToolName } from "@/lib/seo-pillars";
import type { HistoryEntry } from "@/lib/action-history";
import type { DomainMetrics } from "@/lib/seo-tools/dataforseo";
import { pendingKey } from "./action-runner";
import { MarkdownView } from "./markdown-view";
import { DomainDashboard } from "./domain-dashboard";

type Status = "loading" | "ready" | "generating" | "done" | "error" | "missing";

const SEPARATOR = "\n---\n\n";

export function ResultRunner({
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
            .then((j: { status?: string; metrics?: DomainMetrics | null }) => {
              if (j?.status === "ok" && j.metrics) setLiveMetrics(j.metrics);
            })
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

  // ---- Print mode: branded WonderAds PDF layout ----
  if (isPrintMode) {
    const generatedDateStr = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return (
      <PrintLayout
        clientName={clientName}
        actionLabel={action.label}
        resultId={resultId}
        generatedDate={generatedDateStr}
        analysisText={analysisText}
        metrics={liveMetrics}
        showDomainSummary={action.slug === "seo-audit"}
      />
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

// ---- Branded PDF layout ----
//
// Renders a print-only document with a cover page, a Domain Intelligence
// summary, and the SEO Claude analysis. WA logo + astronaut on the cover,
// running footer on every page with seo@wonder-ads.com contact + page
// numbers. Triggered when ?print=true is on the result URL — auto-fires
// window.print() once the page lays out.

function PrintLayout({
  clientName,
  actionLabel,
  resultId,
  generatedDate,
  analysisText,
  metrics,
  showDomainSummary,
}: {
  clientName: string;
  actionLabel: string;
  resultId: string;
  generatedDate: string;
  analysisText: string;
  metrics: DomainMetrics | null;
  showDomainSummary: boolean;
}) {
  return (
    <div className="bg-white text-black">
      <style>{`
        /* Page setup — A4 with WA running footer + page numbers */
        @page {
          size: A4;
          margin: 18mm 16mm 22mm 16mm;
          @bottom-left {
            content: "Wonder Ads · SEO Department · seo@wonder-ads.com";
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            font-size: 8.5pt;
            color: #777;
          }
          @bottom-right {
            content: counter(page) " / " counter(pages);
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            font-size: 8.5pt;
            color: #777;
          }
        }
        @page :first {
          margin: 0;
          @bottom-left { content: none; }
          @bottom-right { content: none; }
        }
        @media print {
          .no-print { display: none !important; }
          .pdf-cover { break-after: page; }
          h2 { break-after: avoid; break-inside: avoid; }
          h3, h4 { break-after: avoid; }
          table { break-inside: avoid; }
          .pdf-stat, .pdf-section-card { break-inside: avoid; }
        }
        html, body { background: white !important; color: #0a0a0a !important; }

        /* Cover page */
        .pdf-cover {
          position: relative;
          height: 100vh;
          min-height: 297mm;
          padding: 32mm 28mm;
          color: white;
          background: linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .pdf-cover-logo {
          width: 120px;
          height: auto;
        }
        .pdf-cover-eyebrow {
          margin-top: 28mm;
          font-size: 11pt;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
        }
        .pdf-cover-title {
          margin-top: 6mm;
          font-size: 48pt;
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.01em;
        }
        .pdf-cover-subtitle {
          margin-top: 4mm;
          font-size: 16pt;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
        }
        .pdf-cover-meta {
          margin-top: auto;
          padding-top: 12mm;
          font-size: 10.5pt;
          color: rgba(255,255,255,0.85);
          line-height: 1.6;
          border-top: 1px solid rgba(255,255,255,0.25);
        }
        .pdf-cover-meta strong { color: white; font-weight: 700; }
        .pdf-cover-astronaut {
          position: absolute;
          right: -8mm;
          bottom: -8mm;
          width: 92mm;
          height: auto;
          opacity: 0.95;
          filter: drop-shadow(0 12px 24px rgba(0,0,0,0.35));
          transform: rotate(-6deg);
          pointer-events: none;
        }
        .pdf-cover-watermark {
          position: absolute;
          right: 28mm;
          top: 28mm;
          font-size: 9pt;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
        }

        /* Body document */
        .pdf-doc {
          color: #1a1a1a;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          max-width: 178mm;
          margin: 0 auto;
        }
        .pdf-doc h1 { font-size: 24pt; font-weight: 700; color: #0a0a0a; margin: 0 0 4mm; letter-spacing: -0.01em; }
        .pdf-doc h2 {
          font-size: 14pt; font-weight: 700; color: #0a0a0a;
          margin: 12mm 0 4mm; padding: 0 0 2mm;
          border-bottom: 2px solid #783DF5;
          display: inline-block;
          padding-right: 8mm;
        }
        .pdf-doc h3 { font-size: 12pt; font-weight: 700; color: #1a1a1a; margin: 8mm 0 2mm; }
        .pdf-doc h4 { font-size: 10.5pt; font-weight: 700; color: #1a1a1a; margin: 5mm 0 2mm; }
        .pdf-doc p, .pdf-doc li {
          font-size: 10pt; line-height: 1.6; color: #2a2a2a;
        }
        .pdf-doc strong { font-weight: 700; color: #0a0a0a; }
        .pdf-doc em { font-style: italic; color: #4a4a4a; }
        .pdf-doc a { color: #5b34c9; text-decoration: none; }
        .pdf-doc ul, .pdf-doc ol { margin: 3mm 0; padding-left: 7mm; }
        .pdf-doc li { margin: 1.5mm 0; }
        .pdf-doc table {
          border-collapse: collapse; width: 100%; margin: 4mm 0;
          font-size: 9pt;
        }
        .pdf-doc th {
          text-align: left; padding: 2mm 3mm;
          background: #f3f0fa; color: #2a1a5a; font-weight: 700;
          border-bottom: 1.5pt solid #5b34c9;
        }
        .pdf-doc td {
          border-bottom: 0.5pt solid #e5e5e5;
          padding: 2mm 3mm; vertical-align: top;
        }
        .pdf-doc pre {
          background: #fafafa; padding: 4mm; border-radius: 1mm;
          border: 1px solid #ececec;
          overflow: auto; font-size: 8.5pt; line-height: 1.5;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        /* CRITICAL — inline code: NO background fill on print. The grey
           boxes were what made the previous output look broken. */
        .pdf-doc code {
          background: transparent;
          border: none;
          padding: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9.5pt;
          color: #5b34c9;
          font-weight: 500;
        }
        .pdf-doc blockquote {
          border-left: 3px solid #783DF5; padding: 1mm 4mm;
          color: #555; margin: 4mm 0; font-style: italic;
        }
        .pdf-doc hr { border: none; border-top: 1px solid #e0e0e0; margin: 6mm 0; }

        /* Domain intelligence summary */
        .pdf-section-card {
          background: #fafafa;
          border: 1px solid #ececec;
          border-radius: 2mm;
          padding: 5mm;
          margin: 6mm 0;
        }
        .pdf-stats {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm;
          margin: 0 0 4mm;
        }
        .pdf-stat {
          border: 1px solid #d4d4d4; border-left: 3px solid #783DF5;
          border-radius: 1.5mm; padding: 3mm 4mm;
          background: white;
        }
        .pdf-stat-label {
          font-size: 7.5pt; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: #666;
        }
        .pdf-stat-value {
          font-size: 16pt; font-weight: 700; color: #0a0a0a;
          margin-top: 1mm; line-height: 1.1;
        }
        .pdf-stat-sub {
          font-size: 7.5pt; color: #777; margin-top: 1mm;
        }

        .pdf-cover-page-content {
          padding: 18mm 16mm 4mm;
        }
        .pdf-empty {
          color: #888; padding: 60mm 0; text-align: center;
        }
        .pdf-toc {
          margin-top: 6mm;
          padding: 5mm 6mm;
          background: #f8f7fc;
          border-left: 3px solid #783DF5;
          font-size: 10pt;
        }
        .pdf-toc-title {
          font-weight: 700; color: #2a1a5a; margin-bottom: 2mm;
          text-transform: uppercase; letter-spacing: 0.13em; font-size: 8pt;
        }
        .pdf-toc-list {
          margin: 0; padding: 0; list-style: none;
        }
        .pdf-toc-list li { padding: 0.8mm 0; color: #4a4a4a; }
      `}</style>

      {/* Cover page */}
      <div className="pdf-cover">
        <span className="pdf-cover-watermark">Wonder Ads · SEO Department</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/wonder-ads-logo.png"
          alt="Wonder Ads"
          className="pdf-cover-logo"
        />
        <div className="pdf-cover-eyebrow">SEO Audit · {clientName}</div>
        <h1 className="pdf-cover-title">{actionLabel}</h1>
        <div className="pdf-cover-subtitle">
          {metrics?.target ? metrics.target : ""}
        </div>
        <div className="pdf-cover-meta">
          <div>
            <strong>Generated:</strong> {generatedDate}
          </div>
          <div>
            <strong>Report ID:</strong>{" "}
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {resultId}
            </span>
          </div>
          <div>
            <strong>Questions?</strong>{" "}
            <a href="mailto:seo@wonder-ads.com" style={{ color: "white" }}>
              seo@wonder-ads.com
            </a>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/astronaut.png"
          alt=""
          aria-hidden="true"
          className="pdf-cover-astronaut"
        />
      </div>

      {/* Body */}
      <div className="pdf-cover-page-content">
        <div className="pdf-doc">
          {showDomainSummary && metrics && (
            <PrintDomainSummary metrics={metrics} />
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
