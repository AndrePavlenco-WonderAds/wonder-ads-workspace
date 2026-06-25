// Printable ADS report — renders a stored KPI snapshot for one client as
// a branded, print-perfect document (browser → Save as PDF). Standalone
// <html> (not in PageShell) so print captures only the report, matching
// the Monthly Report / SEO PrintLayout pattern. KPI numbers come straight
// from the saved snapshot; when no platform was connected at request time
// it says so rather than showing invented figures.

import { notFound } from "next/navigation";
import { getAdsReport } from "@/lib/ads/ads-reports-store";
import { getAdsClient } from "@/lib/ads-clients";
import { ReportDownloadButton } from "@/components/report-download-button";
import { formatDateTime } from "@/lib/dates";
import type { AdsKpis } from "@/lib/ads/ads-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function eur(n: number): string {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
}

const PLATFORM_LABEL: Record<string, string> = {
  all: "Todas as plataformas",
  google: "Google Ads",
  meta: "Meta Ads",
};

export default async function AdsReportPage({
  params,
}: {
  params: Promise<{ slug: string; reportId: string }>;
}) {
  const { slug, reportId } = await params;
  const [report, client] = await Promise.all([
    getAdsReport(slug, reportId),
    Promise.resolve(getAdsClient(slug)),
  ]);
  if (!report || !client) notFound();

  const kpis: AdsKpis | null = report.kpis;
  const pdfTitle = `${client.title} — ${report.kind} — Wonder Ads`;
  const generated = formatDateTime(report.requestedAt);

  const cards: Array<{ label: string; value: string }> = kpis
    ? [
        { label: "Conversões", value: String(kpis.conversions) },
        { label: "ROAS", value: `${kpis.roas.toFixed(1)}x` },
        { label: "CTR", value: `${kpis.ctr.toFixed(1)}%` },
        { label: "CPA", value: eur(kpis.cpa) },
        { label: "Spend", value: eur(kpis.spend) },
      ]
    : [];

  return (
    <html lang="pt">
      <head>
        <title>{pdfTitle}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body>
        <ReportDownloadButton pdfTitle={pdfTitle} />
        <div className="rep">
          <header className="rep-hero">
            <div className="rep-hero-top">
              <div className="rep-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/wonder-ads-butterfly.png" alt="" aria-hidden="true" className="rep-brand-logo" />
                <span className="rep-brand-word">
                  <span className="w">Wonder</span>
                  <span className="a">Ads</span>
                </span>
              </div>
              <div className="rep-hero-dept">
                ADS Department
                <span className="small">{PLATFORM_LABEL[report.platform]}</span>
              </div>
            </div>
            <h1 className="rep-hero-title">{client.title}</h1>
            <div className="rep-hero-sub">
              {report.kind} · {report.windowLabel} · gerado em {generated}
            </div>
          </header>

          <section className="rep-section">
            <h2 className="rep-h2">KPI Snapshot</h2>
            {kpis ? (
              <div className="rep-kpis">
                {cards.map((c) => (
                  <div className="rep-kpi" key={c.label}>
                    <div className="rep-kpi-label">{c.label}</div>
                    <div className="rep-kpi-value">{c.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rep-empty">
                <strong>Sem dados.</strong> No momento do pedido a(s)
                plataforma(s) não estava(m) ligada(s) à app, por isso este
                report não contém métricas. Liga o Google Ads / Meta Ads e gera
                um novo report para puxar dados reais.
              </div>
            )}
          </section>

          <footer className="rep-footer">
            Wonder Ads · ADS Department · {client.title} · gerado em {generated}
            {" · "}wonder-ads.com
          </footer>
        </div>
      </body>
    </html>
  );
}

const STYLES = `
  :root { --grad: linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%); }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #f3f1f8; color: #14111f;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .rep { max-width: 210mm; margin: 0 auto; background: white; min-height: 100vh; }
  .report-download {
    position: fixed; top: 18px; right: 18px; z-index: 50;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 16px; border: none; border-radius: 12px;
    font-size: 13px; font-weight: 700; color: white; cursor: pointer;
    background: var(--grad); box-shadow: 0 8px 26px -6px rgba(120,61,245,0.6);
  }
  .report-download:hover { opacity: 0.92; }
  .rep-hero { background: var(--grad); color: white; padding: 26mm 18mm 16mm; }
  .rep-hero-top { display: flex; align-items: flex-start; justify-content: space-between; }
  .rep-brand { display: flex; align-items: center; gap: 10px; }
  .rep-brand-logo { width: 38px; height: 38px; }
  .rep-brand-word { font-size: 19pt; font-weight: 800; letter-spacing: -0.01em; }
  .rep-brand-word .w { color: white; }
  .rep-brand-word .a {
    background: linear-gradient(135deg, #ff8ae6 0%, #ffd2ff 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
  }
  .rep-hero-dept { text-align: right; font-size: 9pt; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; }
  .rep-hero-dept .small { display: block; margin-top: 3px; font-size: 7.5pt; letter-spacing: 0.16em; color: rgba(255,255,255,0.7); font-weight: 500; }
  .rep-hero-title { margin: 12mm 0 0; font-size: 38pt; font-weight: 800; letter-spacing: -0.02em; }
  .rep-hero-sub { margin-top: 6px; font-size: 11pt; color: rgba(255,255,255,0.9); }
  .rep-section { padding: 8mm 18mm; }
  .rep-h2 { font-size: 14pt; font-weight: 800; margin: 0 0 5mm; padding-bottom: 2mm; border-bottom: 2px solid #783DF5; display: inline-block; }
  .rep-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4mm; }
  .rep-kpi { border: 1px solid #e4e0ef; border-top: 3px solid #783DF5; border-radius: 3mm; padding: 4mm; background: #fbfaff; }
  .rep-kpi-label { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6580; }
  .rep-kpi-value { font-size: 20pt; font-weight: 800; margin-top: 2mm; line-height: 1; color: #5b34c9; }
  .rep-empty { border: 1px solid #f0d49a; background: #fdf6e8; color: #7a5a17; border-radius: 3mm; padding: 6mm; font-size: 10pt; line-height: 1.6; }
  .rep-footer { padding: 8mm 18mm; text-align: center; font-size: 8pt; color: #9b96a8; border-top: 0.5pt solid #eee; }
  @media print {
    @page { size: A4; margin: 0; }
    html, body { background: white; }
    .no-print { display: none !important; }
    .rep { max-width: none; }
  }
`;
