// Branded WonderAds PDF for any SEO action result.
//
// Rendered DIRECTLY from the result page (NOT wrapped in PageShell) when
// the URL has ?print=true. That bypass is critical — the previous version
// kept rendering inside PageShell, so the browser print captured the
// app chrome on top of this layout and the cover wouldn't fill the page.
//
// This file is a Server Component so it can be returned straight from
// page.tsx without any client roundtrip. The only client bit is a tiny
// AutoPrint helper that fires window.print() once the document is laid
// out.

import { MarkdownView } from "./markdown-view";
import { AutoPrint } from "./auto-print";
import { formatDisplayResultId } from "@/lib/action-history";
import type { DomainMetrics } from "@/lib/seo-tools/dataforseo";
import type { SiteVitals } from "@/lib/audit-prep-store";
import type { PsiResult } from "@/lib/seo-tools/pagespeed";
import type { KwResearchPack, KwIdea } from "@/lib/seo-tools/keyword-research";

export function PrintLayout({
  clientName,
  actionLabel,
  resultId,
  generatedDate,
  consultant,
  consultantEmail,
  analysisText,
  metrics,
  vitals,
  kwResearch,
  showDomainSummary,
  showKeywordResearchSummary,
}: {
  clientName: string;
  actionLabel: string;
  resultId: string;
  generatedDate: string;
  consultant: string;
  consultantEmail: string;
  analysisText: string;
  metrics: DomainMetrics | null;
  vitals: SiteVitals | null;
  kwResearch: KwResearchPack | null;
  showDomainSummary: boolean;
  showKeywordResearchSummary: boolean;
}) {
  // Strip the HHMM segment from the result id so the cover page doesn't
  // disclose the minute the consultant pressed Generate. The full id is
  // still used in the URL — this is purely a display change.
  const displayResultId = formatDisplayResultId(resultId);
  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <title>
          {actionLabel} · {clientName} · Wonder Ads
        </title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style
          dangerouslySetInnerHTML={{
            __html: PRINT_STYLES.replace(
              /__CONSULTANT_EMAIL__/g,
              consultantEmail,
            ),
          }}
        />
      </head>
      <body>
        <AutoPrint />

        {/* --- Cover page (full-bleed, no margins) --- */}
        <div className="pdf-cover">
          <div className="pdf-cover-top">
            <div className="pdf-cover-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/wonder-ads-butterfly.png"
                alt=""
                aria-hidden="true"
                className="pdf-cover-brand-logo"
              />
              <span className="pdf-cover-brand-wordmark">
                <span className="wonder">Wonder</span>
                <span className="ads">Ads</span>
              </span>
            </div>
            <div className="pdf-cover-dept">
              SEO Department
              <span className="small">Audit Report</span>
            </div>
          </div>

          <div className="pdf-cover-body">
            <div className="pdf-cover-eyebrow">
              {actionLabel} · {clientName}
            </div>
            <h1 className="pdf-cover-title">{actionLabel}</h1>
            <div className="pdf-cover-subtitle">{metrics?.target ?? ""}</div>
            <div className="pdf-cover-meta">
              <div>
                <strong>Audited:</strong> {generatedDate}
              </div>
              <div>
                <strong>Head SEO Consultant:</strong> {consultant}
              </div>
              <div>
                <strong>Report ID:</strong>{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>
                  {displayResultId}
                </span>
              </div>
              <div>
                <strong>Questions?</strong>{" "}
                <a
                  href={`mailto:${consultantEmail}`}
                  style={{ color: "white" }}
                >
                  {consultantEmail}
                </a>
              </div>
              <div className="pdf-cover-site">
                <a
                  href="https://wonder-ads.com"
                  style={{ color: "white", textDecoration: "none" }}
                >
                  wonder-ads.com
                </a>
              </div>
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

        {/* --- Body pages --- */}
        <main className="pdf-body-wrapper">
          <div className="pdf-doc">
            <div className="pdf-page-header">
              <div className="pdf-page-header-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/wonder-ads-butterfly.png"
                  alt=""
                  aria-hidden="true"
                  className="pdf-page-header-logo"
                />
                <span className="pdf-page-header-wordmark">
                  Wonder<span className="gradient">Ads</span>
                </span>
              </div>
              <div className="pdf-page-header-meta">
                SEO Department
                <span className="small">
                  {actionLabel} · {clientName}
                </span>
              </div>
            </div>

            {showDomainSummary && metrics && (
              <PrintDomainSummary metrics={metrics} />
            )}
            {showDomainSummary && vitals && (
              <PrintCoreWebVitals vitals={vitals} />
            )}
            {showKeywordResearchSummary && kwResearch && (
              <PrintKeywordResearchSummary pack={kwResearch} />
            )}

            {analysisText ? (
              <MarkdownView source={analysisText} />
            ) : (
              <div className="pdf-empty">
                <p>
                  <strong>This result hasn&apos;t been saved yet.</strong>
                </p>
              </div>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}

function PrintDomainSummary({ metrics }: { metrics: DomainMetrics }) {
  return (
    <>
      <h2>Domain intelligence</h2>
      <div className="pdf-stats">
        <div className="pdf-stat">
          <div className="pdf-stat-label">Authority</div>
          <div className="pdf-stat-value">
            {metrics.rankNormalised ?? "—"}
            {metrics.rankNormalised != null && (
              <span style={{ fontSize: 11, color: "#888" }}>/100</span>
            )}
          </div>
          {metrics.rank != null && (
            <div className="pdf-stat-sub">Rank {metrics.rank}</div>
          )}
        </div>
        <div className="pdf-stat">
          <div className="pdf-stat-label">Organic keywords</div>
          <div className="pdf-stat-value">{fmtNum(metrics.organicKeywords)}</div>
          {metrics.organicCount && (
            <div className="pdf-stat-sub">
              Top 3: {metrics.organicCount.top3} · Top 10:{" "}
              {metrics.organicCount.top10}
            </div>
          )}
        </div>
        <div className="pdf-stat">
          <div className="pdf-stat-label">Est. monthly traffic (ETV)</div>
          <div className="pdf-stat-value">
            {fmtNum(
              metrics.organicEtv != null ? Math.round(metrics.organicEtv) : null,
            )}
          </div>
        </div>
        <div className="pdf-stat">
          <div className="pdf-stat-label">Referring domains</div>
          <div className="pdf-stat-value">{fmtNum(metrics.referringDomains)}</div>
          {metrics.backlinks != null && (
            <div className="pdf-stat-sub">
              {fmtNum(metrics.backlinks)} backlinks
            </div>
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
                <th style={{ textAlign: "right" }}>KD</th>
                <th style={{ textAlign: "right" }}>ETV</th>
              </tr>
            </thead>
            <tbody>
              {[...metrics.topKeywords]
                .sort(
                  (a, b) =>
                    (a.position ?? Number.MAX_SAFE_INTEGER) -
                    (b.position ?? Number.MAX_SAFE_INTEGER),
                )
                .slice(0, 30)
                .map((k, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{k.keyword}</td>
                    <td style={{ textAlign: "right" }}>{k.position}</td>
                    <td style={{ textAlign: "right" }}>
                      {fmtNum(k.searchVolume)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {k.competition != null
                        ? `${Math.round(k.competition * 100)}%`
                        : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmtNum(
                        k.estTraffic != null
                          ? Math.round(k.estTraffic * 10) / 10
                          : null,
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

function PrintKeywordResearchSummary({ pack }: { pack: KwResearchPack }) {
  const totalKeywords =
    pack.suggestions.length +
    pack.ideas.length +
    pack.domainExisting.length +
    pack.competitors.reduce((s, c) => s + c.keywords.length, 0);
  const totalVolume = sumVolume([
    ...pack.suggestions,
    ...pack.ideas,
    ...pack.domainExisting,
  ]);
  const topSuggestions = [...pack.suggestions]
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 25);
  const topDomain = [...pack.domainExisting].slice(0, 20);
  return (
    <>
      <h2>Keyword universe</h2>
      <div className="pdf-stats">
        <div className="pdf-stat">
          <div className="pdf-stat-label">Total keywords</div>
          <div className="pdf-stat-value">{fmtNum(totalKeywords)}</div>
          <div className="pdf-stat-sub">
            {pack.suggestions.length} suggestions · {pack.ideas.length} ideas
          </div>
        </div>
        <div className="pdf-stat">
          <div className="pdf-stat-label">Total volume / mo</div>
          <div className="pdf-stat-value">{fmtNum(totalVolume)}</div>
          <div className="pdf-stat-sub">
            Across suggestions + ideas + already-ranking
          </div>
        </div>
        <div className="pdf-stat">
          <div className="pdf-stat-label">Already-ranking</div>
          <div className="pdf-stat-value">{pack.domainExisting.length}</div>
          <div className="pdf-stat-sub">
            Quick-win optimisation targets on the client&apos;s domain
          </div>
        </div>
        <div className="pdf-stat">
          <div className="pdf-stat-label">Competitors analysed</div>
          <div className="pdf-stat-value">{pack.competitors.length}</div>
          <div className="pdf-stat-sub">
            {pack.geo.countryLabel} · {pack.geo.languageCode}
          </div>
        </div>
      </div>

      {topSuggestions.length > 0 && (
        <>
          <h3>Top 25 keyword opportunities (by volume)</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Keyword</th>
                <th style={{ textAlign: "right" }}>Vol/mo</th>
                <th style={{ textAlign: "right" }}>KD</th>
                <th>Intent</th>
              </tr>
            </thead>
            <tbody>
              {topSuggestions.map((k, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{k.keyword}</td>
                  <td style={{ textAlign: "right" }}>{fmtNum(k.searchVolume)}</td>
                  <td style={{ textAlign: "right" }}>{k.difficulty ?? "—"}</td>
                  <td>{k.intent ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {topDomain.length > 0 && (
        <>
          <h3>Already-ranking on the client&apos;s domain (top 20)</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Keyword</th>
                <th style={{ textAlign: "right" }}>Vol/mo</th>
                <th style={{ textAlign: "right" }}>KD</th>
                <th>Intent</th>
              </tr>
            </thead>
            <tbody>
              {topDomain.map((k, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{k.keyword}</td>
                  <td style={{ textAlign: "right" }}>{fmtNum(k.searchVolume)}</td>
                  <td style={{ textAlign: "right" }}>{k.difficulty ?? "—"}</td>
                  <td>{k.intent ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {pack.competitors.length > 0 && (
        <>
          <h3>Competitor footprints</h3>
          {pack.competitors.map((c) => (
            <div key={c.domain} style={{ marginBottom: "6mm" }}>
              <p>
                <strong>{c.domain}</strong> — {c.keywords.length} keywords in
                theme.
              </p>
              {c.keywords.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th style={{ textAlign: "right" }}>Vol/mo</th>
                      <th style={{ textAlign: "right" }}>KD</th>
                      <th>Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.keywords.slice(0, 12).map((k, i) => (
                      <tr key={i}>
                        <td>{k.keyword}</td>
                        <td style={{ textAlign: "right" }}>{fmtNum(k.searchVolume)}</td>
                        <td style={{ textAlign: "right" }}>{k.difficulty ?? "—"}</td>
                        <td>{k.intent ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      )}
    </>
  );
}

function sumVolume(list: KwIdea[]): number {
  return list.reduce((s, k) => s + (k.searchVolume ?? 0), 0);
}

function PrintCoreWebVitals({ vitals }: { vitals: SiteVitals }) {
  if (!vitals.mobile && !vitals.desktop) return null;
  return (
    <>
      <h2>Core Web Vitals</h2>
      <p style={{ marginTop: "-2mm", color: "#666", fontSize: "9.5pt" }}>
        Real-user p75 values from Google&apos;s Chrome User Experience Report
        (28-day window). Lab values used as fallback when field data is
        unavailable, marked with <em>lab</em>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Device</th>
            <th>Perf</th>
            <th>SEO</th>
            <th>A11y</th>
            <th>BP</th>
            <th>LCP</th>
            <th>INP</th>
            <th>CLS</th>
            <th>FCP</th>
            <th>TTFB</th>
          </tr>
        </thead>
        <tbody>
          <CwvRow label="📱 Mobile" psi={vitals.mobile ?? null} />
          <CwvRow label="🖥 Desktop" psi={vitals.desktop ?? null} />
        </tbody>
      </table>
    </>
  );
}

function CwvRow({ label, psi }: { label: string; psi: PsiResult | null }) {
  if (!psi) {
    return (
      <tr>
        <td>{label}</td>
        <td colSpan={9} style={{ color: "#888" }}>
          Not measured.
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td>
        <strong>{label}</strong>
      </td>
      <td>{psi.scores.performance ?? "—"}</td>
      <td>{psi.scores.seo ?? "—"}</td>
      <td>{psi.scores.accessibility ?? "—"}</td>
      <td>{psi.scores.bestPractices ?? "—"}</td>
      <td>{cwvCell(psi.fieldData.lcpMs, psi.labData.lcpMs, "ms", 0)}</td>
      <td>{cwvCell(psi.fieldData.inpMs, psi.labData.inpMs, "ms", 0)}</td>
      <td>{cwvCell(psi.fieldData.cls, psi.labData.cls, "", 3)}</td>
      <td>{cwvCell(psi.fieldData.fcpMs, psi.labData.fcpMs, "ms", 0)}</td>
      <td>{cwvCell(psi.fieldData.ttfbMs, psi.labData.ttfbMs, "ms", 0)}</td>
    </tr>
  );
}

function cwvCell(
  field: number | null,
  lab: number | null,
  unit: string,
  decimals: number,
): React.ReactNode {
  const usingField = field !== null;
  const value = usingField ? field : lab;
  if (value === null) return "—";
  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value);
  return (
    <>
      {formatted}
      {unit}
      {!usingField && <span style={{ color: "#888" }}> <em>lab</em></span>}
    </>
  );
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v < 1000) return v.toString();
  if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
  return `${(v / 1_000_000).toFixed(2)}M`;
}

const PRINT_STYLES = `
  /* Page setup — A4 with WA running footer + page numbers */
  @page {
    size: A4;
    margin: 22mm 16mm 22mm 16mm;
    @bottom-left {
      content: "Wonder Ads · SEO Department · __CONSULTANT_EMAIL__";
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
    .pdf-cover { break-after: page; }
    h2 { break-after: avoid; break-inside: avoid; }
    h3, h4 { break-after: avoid; }
    table { break-inside: avoid; }
    .pdf-stat, .pdf-section-card { break-inside: avoid; }
    /* Force backgrounds + colors to print. Chrome defaults to skipping
       them, which made the cover render blank. */
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
  html, body {
    background: white !important;
    color: #0a0a0a !important;
    margin: 0;
    padding: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }

  /* Brand header on every body page (the @page footer handles per-page
     WA + page number; this header is positioned at the top of each body
     content section). */
  .pdf-page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4mm 0 3mm;
    margin-bottom: 6mm;
    border-bottom: 1px solid #ececec;
  }
  .pdf-page-header-brand { display: flex; align-items: center; gap: 2.5mm; }
  .pdf-page-header-logo { width: 8mm; height: 8mm; }
  .pdf-page-header-wordmark {
    font-size: 11pt; font-weight: 700; color: #0a0a0a; letter-spacing: -0.01em;
  }
  .pdf-page-header-wordmark .gradient {
    background: linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }
  .pdf-page-header-meta {
    text-align: right;
    font-size: 8pt;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 700;
    color: #5b34c9;
  }
  .pdf-page-header-meta .small {
    display: block;
    margin-top: 1mm;
    color: #888;
    letter-spacing: 0.1em;
    font-weight: 500;
    font-size: 7.5pt;
  }

  /* --- Cover page --- */
  .pdf-cover {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    padding: 22mm 22mm 22mm 22mm;
    color: white;
    background: linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
  .pdf-cover-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12mm;
  }
  .pdf-cover-brand { display: flex; align-items: center; gap: 4mm; }
  .pdf-cover-brand-logo { width: 18mm; height: 18mm; }
  .pdf-cover-brand-wordmark {
    font-size: 22pt;
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1;
  }
  .pdf-cover-brand-wordmark .wonder { color: white; }
  .pdf-cover-brand-wordmark .ads {
    background: linear-gradient(135deg, #ff8ae6 0%, #ffd2ff 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }
  .pdf-cover-dept {
    text-align: right;
    font-size: 10pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
  }
  .pdf-cover-dept .small {
    display: block;
    margin-top: 1mm;
    font-size: 8.5pt;
    letter-spacing: 0.18em;
    color: rgba(255,255,255,0.65);
    font-weight: 500;
  }
  .pdf-cover-body {
    margin-top: auto;
    padding-bottom: 8mm;
  }
  .pdf-cover-eyebrow {
    font-size: 11pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
  }
  .pdf-cover-title {
    margin: 5mm 0 0;
    font-size: 56pt;
    font-weight: 800;
    line-height: 1.02;
    letter-spacing: -0.015em;
    color: white;
  }
  .pdf-cover-subtitle {
    margin-top: 4mm;
    font-size: 17pt;
    font-weight: 500;
    color: rgba(255,255,255,0.92);
  }
  .pdf-cover-meta {
    margin-top: 12mm;
    padding-top: 6mm;
    font-size: 10.5pt;
    color: rgba(255,255,255,0.92);
    line-height: 1.7;
    border-top: 1px solid rgba(255,255,255,0.3);
    max-width: 110mm;
  }
  .pdf-cover-meta strong { color: white; font-weight: 700; }
  .pdf-cover-site {
    margin-top: 4mm;
    font-size: 11pt;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: rgba(255,255,255,0.98);
  }
  .pdf-cover-astronaut {
    position: absolute;
    right: -6mm;
    bottom: -6mm;
    width: 88mm;
    height: auto;
    filter: drop-shadow(0 12px 24px rgba(0,0,0,0.35));
    pointer-events: none;
  }

  /* --- Body --- */
  .pdf-body-wrapper { padding: 12mm 16mm 4mm; }
  .pdf-doc {
    color: #1a1a1a;
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
  .pdf-doc p, .pdf-doc li { font-size: 10pt; line-height: 1.6; color: #2a2a2a; }
  .pdf-doc strong { font-weight: 700; color: #0a0a0a; }
  .pdf-doc em { font-style: italic; color: #4a4a4a; }
  .pdf-doc a { color: #5b34c9; text-decoration: none; }
  .pdf-doc ul, .pdf-doc ol { margin: 3mm 0; padding-left: 7mm; }
  .pdf-doc li { margin: 1.5mm 0; }
  .pdf-doc table {
    border-collapse: collapse; width: 100%; margin: 4mm 0;
    font-size: 9pt;
    table-layout: auto;
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
  .pdf-stat-sub { font-size: 7.5pt; color: #777; margin-top: 1mm; }
  .pdf-empty { color: #888; padding: 60mm 0; text-align: center; }

  /* MarkdownView ships with Tailwind text-white/85 + text-white/80 inline on
     its wrapper, headings, cells, etc — those override the .pdf-doc colors
     and make the whole body white-on-white when printed. Force everything
     inside .seo-markdown back to dark with !important so the PDF is
     actually readable. */
  .pdf-doc .seo-markdown,
  .pdf-doc .seo-markdown p,
  .pdf-doc .seo-markdown li,
  .pdf-doc .seo-markdown td,
  .pdf-doc .seo-markdown th,
  .pdf-doc .seo-markdown blockquote,
  .pdf-doc .seo-markdown em { color: #2a2a2a !important; }
  .pdf-doc .seo-markdown h1,
  .pdf-doc .seo-markdown h2,
  .pdf-doc .seo-markdown h3,
  .pdf-doc .seo-markdown h4,
  .pdf-doc .seo-markdown strong { color: #0a0a0a !important; }
  .pdf-doc .seo-markdown a { color: #5b34c9 !important; }
  .pdf-doc .seo-markdown code {
    color: #5b34c9 !important;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
  }
  .pdf-doc .seo-markdown th {
    background: #f3f0fa !important;
    color: #2a1a5a !important;
  }
  .pdf-doc .seo-markdown thead { border-bottom: 1.5pt solid #5b34c9 !important; }
  .pdf-doc .seo-markdown td { border-bottom: 0.5pt solid #e5e5e5 !important; }
`;
