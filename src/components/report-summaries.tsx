// Structured-data summaries for SEO action results — the "Domain
// intelligence", "Core Web Vitals" and "Keyword universe" blocks.
//
// Light-themed, semantic HTML using the `pdf-*` class names. Shared by:
//   • PrintLayout (the downloadable PDF), and
//   • PublicReportView (the client-facing preview page in the Pending
//     Review flow) — so the client sees the same dashboard data on screen
//     that the PDF contains, not just the written analysis.
//
// Each consuming surface supplies the `.pdf-stats` / `.pdf-stat*` CSS in
// its own scope (print stylesheet vs the public-report screen styles).

import type { DomainMetrics } from "@/lib/seo-tools/dataforseo";
import type { SiteVitals } from "@/lib/audit-prep-store";
import type { PsiResult } from "@/lib/seo-tools/pagespeed";
import type { KwResearchPack, KwIdea } from "@/lib/seo-tools/keyword-research";

export function DomainSummary({ metrics }: { metrics: DomainMetrics }) {
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

export function KeywordUniverseSummary({ pack }: { pack: KwResearchPack }) {
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

export function CoreWebVitalsSummary({ vitals }: { vitals: SiteVitals }) {
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
      {!usingField && (
        <span style={{ color: "#888" }}>
          {" "}
          <em>lab</em>
        </span>
      )}
    </>
  );
}

export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v < 1000) return v.toString();
  if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
  return `${(v / 1_000_000).toFixed(2)}M`;
}
