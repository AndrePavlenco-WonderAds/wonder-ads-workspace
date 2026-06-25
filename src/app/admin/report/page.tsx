// Monthly Report — a standalone, print-perfect document (NOT wrapped in
// PageShell, so the browser print captures only the report, matching the
// SEO PrintLayout pattern). Opens in its own tab from the Clients page
// and offers a "Descarregar PDF" button (browser print → Save as PDF).

import { buildMonthlyReport } from "@/lib/monthly-report";
import { ReportDownloadButton } from "@/components/report-download-button";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Relatório Mensal — Wonder Ads",
};

const DEPT_COLOR: Record<string, string> = {
  SEO: "#783DF5",
  ADS: "#C535C9",
  Web: "#22b8cf",
};
const TYPE_COLOR: Record<string, string> = {
  Canva: "#38bdf8",
  Contabilidade: "#f59e0b",
  Plataforma: "#a78bfa",
};

function eur(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export default async function MonthlyReportPage() {
  const r = await buildMonthlyReport();
  const pdfTitle = `Relatório Mensal ${r.monthLabel} — Wonder Ads`;
  const generated = formatDate(r.generatedAtISO);

  const maxDeptMrr = Math.max(1, ...r.byDepartment.map((d) => d.mrr));
  const maxTypeCount = Math.max(1, ...r.byInvoiceType.map((t) => t.count));
  const sentPct =
    r.month.invoicesDue > 0
      ? Math.round((r.month.invoicesSent / r.month.invoicesDue) * 100)
      : 0;

  return (
    <html lang="pt">
      <head>
        <title>{pdfTitle}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: REPORT_STYLES }} />
      </head>
      <body>
        <ReportDownloadButton pdfTitle={pdfTitle} />

        <div className="rep">
          {/* Header band */}
          <header className="rep-hero">
            <div className="rep-hero-top">
              <div className="rep-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/wonder-ads-butterfly.png"
                  alt=""
                  aria-hidden="true"
                  className="rep-brand-logo"
                />
                <span className="rep-brand-word">
                  <span className="w">Wonder</span>
                  <span className="a">Ads</span>
                </span>
              </div>
              <div className="rep-hero-dept">
                Relatório Mensal
                <span className="small">SuperAdmin · Faturação</span>
              </div>
            </div>
            <h1 className="rep-hero-title">{r.monthLabel}</h1>
            <div className="rep-hero-sub">
              Visão geral de clientes, receita e obrigações · gerado em{" "}
              {generated}
            </div>
          </header>

          {/* KPIs */}
          <section className="rep-section">
            <div className="rep-kpis">
              <Kpi label="Clientes" value={String(r.clientCount)} sub={`${r.engagementCount} engagements`} />
              <Kpi label="MRR" value={eur(r.mrr)} sub="receita mensal" accent />
              <Kpi label="Run-rate anual" value={eur(r.annualRunRate)} sub="MRR × 12" />
              <Kpi label="Obrigações Fiscais" value={eur(r.ivaTotal)} sub="IVA total" danger />
              <Kpi label="Ticket médio" value={eur(r.avgTicket)} sub="por engagement" />
            </div>
          </section>

          {/* By department + invoice type */}
          <section className="rep-section">
            <div className="rep-cols">
              <div className="rep-card">
                <h2>Receita por departamento</h2>
                <div className="rep-bars">
                  {r.byDepartment.map((d) => (
                    <div className="rep-bar-row" key={d.dept}>
                      <span className="rep-bar-label">
                        {d.dept}
                        <em>{d.engagements} clientes</em>
                      </span>
                      <span className="rep-bar-track">
                        <span
                          className="rep-bar-fill"
                          style={{
                            width: `${(d.mrr / maxDeptMrr) * 100}%`,
                            background: DEPT_COLOR[d.dept] ?? "#783DF5",
                          }}
                        />
                      </span>
                      <span className="rep-bar-value">{eur(d.mrr)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rep-card">
                <h2>Por tipo de fatura</h2>
                <div className="rep-bars">
                  {r.byInvoiceType.map((t) => (
                    <div className="rep-bar-row" key={t.type}>
                      <span className="rep-bar-label">
                        {t.type}
                        <em>{eur(t.value)}/mês</em>
                      </span>
                      <span className="rep-bar-track">
                        <span
                          className="rep-bar-fill"
                          style={{
                            width: `${(t.count / maxTypeCount) * 100}%`,
                            background: TYPE_COLOR[t.type] ?? "#a78bfa",
                          }}
                        />
                      </span>
                      <span className="rep-bar-value">{t.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Este mês */}
          <section className="rep-section">
            <h2 className="rep-h2">Este mês · {r.monthLabel}</h2>
            <div className="rep-kpis four">
              <Kpi label="Faturas a enviar" value={String(r.month.invoicesDue)} sub="com data este mês" />
              <Kpi label="Valor a faturar" value={eur(r.month.invoicesValue)} sub="soma mensal" accent />
              <Kpi label="IVA do mês" value={eur(r.month.invoicesIva)} sub="a entregar" danger />
              <Kpi
                label="Enviadas"
                value={`${r.month.invoicesSent}/${r.month.invoicesDue}`}
                sub={`${sentPct}% concluído`}
              />
            </div>
            <div className="rep-progress">
              <span className="rep-progress-fill" style={{ width: `${sentPct}%` }} />
            </div>
            {r.month.events.length > 0 && (
              <div className="rep-card" style={{ marginTop: "5mm" }}>
                <h3>Obrigações e eventos do mês</h3>
                <ul className="rep-events">
                  {r.month.events.map((e, i) => (
                    <li key={i}>
                      <span className="rep-ev-date">{formatDate(e.date)}</span>
                      <span className="rep-ev-title">{e.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Trimestre + YTD */}
          <section className="rep-section">
            <div className="rep-cols">
              <div className="rep-card">
                <h2>Trimestre · {r.quarterLabel}</h2>
                <dl className="rep-dl">
                  <Row k="Novos clientes" v={String(r.quarter.newClients)} />
                  <Row k="Faturas no trimestre" v={String(r.quarter.invoicesDue)} />
                  <Row k="Run-rate trimestral" v={eur(r.quarter.runRate)} />
                  <Row k="IVA estimado" v={eur(r.quarter.ivaEstimate)} />
                </dl>
              </div>
              <div className="rep-card">
                <h2>Desde Janeiro · {r.ytdLabel}</h2>
                <dl className="rep-dl">
                  <Row k="Novos clientes (YTD)" v={String(r.ytd.newClients)} />
                  <Row
                    k="Faturação estimada"
                    v={eur(r.ytd.billedEstimate)}
                    hint={`${r.ytd.monthsCovered} meses`}
                  />
                  <Row k="IVA acumulado (est.)" v={eur(r.ytd.ivaEstimate)} />
                </dl>
                <p className="rep-note">
                  Estimativas calculadas a partir do valor mensal × meses
                  ativos de cada cliente no ano.
                </p>
              </div>
            </div>
          </section>

          {/* Full client table */}
          <section className="rep-section">
            <h2 className="rep-h2">Todos os clientes</h2>
            <table className="rep-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Dept</th>
                  <th>Tipo de fatura</th>
                  <th className="num">Valor mensal</th>
                  <th className="num">IVA</th>
                  <th>Data fatura</th>
                </tr>
              </thead>
              <tbody>
                {r.clients.map((c) => (
                  <tr key={`${c.slug}-${c.department}`}>
                    <td>{c.title}</td>
                    <td>
                      <span
                        className="rep-pill"
                        style={{
                          background: `${DEPT_COLOR[c.department] ?? "#783DF5"}22`,
                          color: DEPT_COLOR[c.department] ?? "#783DF5",
                        }}
                      >
                        {c.department}
                      </span>
                    </td>
                    <td>{c.invoiceType}</td>
                    <td className="num">
                      {c.monthlyValue != null ? eur(c.monthlyValue) : "—"}
                    </td>
                    <td className="num">{c.iva != null ? eur(c.iva) : "—"}</td>
                    <td>{c.invoiceDate ? formatDate(c.invoiceDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total · {r.engagementCount} engagements</td>
                  <td className="num">{eur(r.mrr)}</td>
                  <td className="num">{eur(r.ivaTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </section>

          <footer className="rep-footer">
            Wonder Ads · Relatório Mensal {r.monthLabel} · gerado em {generated}
            {" · "}
            wonder-ads.com
          </footer>
        </div>
      </body>
    </html>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
  danger,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  danger?: boolean;
}) {
  const cls = accent ? "rep-kpi accent" : danger ? "rep-kpi danger" : "rep-kpi";
  return (
    <div className={cls}>
      <div className="rep-kpi-label">{label}</div>
      <div className="rep-kpi-value">{value}</div>
      <div className="rep-kpi-sub">{sub}</div>
    </div>
  );
}

function Row({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="rep-dl-row">
      <dt>{k}</dt>
      <dd>
        {v}
        {hint && <span className="rep-dl-hint"> · {hint}</span>}
      </dd>
    </div>
  );
}

const REPORT_STYLES = `
  :root { --grad: linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%); }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #f3f1f8; color: #14111f;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .rep { max-width: 210mm; margin: 0 auto; background: white; }

  /* Floating download button */
  .report-download {
    position: fixed; top: 18px; right: 18px; z-index: 50;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 16px; border: none; border-radius: 12px;
    font-size: 13px; font-weight: 700; color: white; cursor: pointer;
    background: var(--grad);
    box-shadow: 0 8px 26px -6px rgba(120,61,245,0.6);
  }
  .report-download:hover { opacity: 0.92; }
  .report-download:disabled { opacity: 0.6; cursor: default; }

  /* Hero */
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
  .rep-hero-dept {
    text-align: right; font-size: 9pt; letter-spacing: 0.2em;
    text-transform: uppercase; font-weight: 700; color: rgba(255,255,255,0.95);
  }
  .rep-hero-dept .small {
    display: block; margin-top: 3px; font-size: 7.5pt;
    letter-spacing: 0.16em; color: rgba(255,255,255,0.7); font-weight: 500;
  }
  .rep-hero-title { margin: 12mm 0 0; font-size: 40pt; font-weight: 800; letter-spacing: -0.02em; }
  .rep-hero-sub { margin-top: 6px; font-size: 11pt; color: rgba(255,255,255,0.9); }

  /* Sections */
  .rep-section { padding: 8mm 18mm 0; }
  .rep-section:last-of-type { padding-bottom: 8mm; }
  .rep-h2 {
    font-size: 14pt; font-weight: 800; margin: 0 0 5mm;
    padding-bottom: 2mm; border-bottom: 2px solid #783DF5; display: inline-block;
  }

  /* KPIs */
  .rep-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4mm; }
  .rep-kpis.four { grid-template-columns: repeat(4, 1fr); }
  .rep-kpi {
    border: 1px solid #e4e0ef; border-radius: 3mm; padding: 4mm; background: #fbfaff;
    border-top: 3px solid #cfc6e8;
  }
  .rep-kpi.accent { border-top-color: #783DF5; }
  .rep-kpi.danger { border-top-color: #e11d48; }
  .rep-kpi-label {
    font-size: 7.5pt; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: #6b6580;
  }
  .rep-kpi-value { font-size: 18pt; font-weight: 800; margin-top: 2mm; line-height: 1; color: #14111f; }
  .rep-kpi.accent .rep-kpi-value { color: #5b34c9; }
  .rep-kpi.danger .rep-kpi-value { color: #be123c; }
  .rep-kpi-sub { font-size: 7.5pt; color: #8b8699; margin-top: 2mm; }

  /* Two-column cards */
  .rep-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .rep-card { border: 1px solid #e4e0ef; border-radius: 3mm; padding: 5mm; background: white; }
  .rep-card h2 { font-size: 11.5pt; font-weight: 800; margin: 0 0 4mm; color: #14111f; }
  .rep-card h3 { font-size: 10pt; font-weight: 700; margin: 0 0 3mm; color: #14111f; }

  /* Bars */
  .rep-bars { display: flex; flex-direction: column; gap: 3.5mm; }
  .rep-bar-row { display: grid; grid-template-columns: 28mm 1fr 20mm; align-items: center; gap: 3mm; }
  .rep-bar-label { font-size: 9pt; font-weight: 700; color: #2a2440; }
  .rep-bar-label em { display: block; font-style: normal; font-size: 7.5pt; font-weight: 500; color: #8b8699; margin-top: 0.5mm; }
  .rep-bar-track { height: 7mm; background: #efecf7; border-radius: 2mm; overflow: hidden; }
  .rep-bar-fill { display: block; height: 100%; border-radius: 2mm; min-width: 2mm; }
  .rep-bar-value { font-size: 9.5pt; font-weight: 800; text-align: right; color: #14111f; }

  /* Progress */
  .rep-progress { height: 5mm; background: #efecf7; border-radius: 2mm; overflow: hidden; margin-top: 4mm; }
  .rep-progress-fill { display: block; height: 100%; background: linear-gradient(90deg,#10b981,#34d399); }

  /* Events */
  .rep-events { list-style: none; margin: 0; padding: 0; }
  .rep-events li { display: flex; gap: 4mm; padding: 1.8mm 0; border-bottom: 0.4pt solid #eee; font-size: 9pt; }
  .rep-ev-date { width: 24mm; color: #6b6580; font-weight: 600; }
  .rep-ev-title { color: #14111f; font-weight: 600; }

  /* Definition lists */
  .rep-dl { margin: 0; }
  .rep-dl-row { display: flex; justify-content: space-between; align-items: baseline; padding: 2.4mm 0; border-bottom: 0.4pt solid #eee; }
  .rep-dl-row:last-child { border-bottom: none; }
  .rep-dl dt { font-size: 9.5pt; color: #4a4560; }
  .rep-dl dd { margin: 0; font-size: 12pt; font-weight: 800; color: #14111f; }
  .rep-dl-hint { font-size: 8pt; font-weight: 500; color: #9b96a8; }
  .rep-note { font-size: 7.5pt; color: #9b96a8; margin: 4mm 0 0; font-style: italic; }

  /* Table */
  .rep-table { width: 100%; border-collapse: collapse; margin-top: 1mm; font-size: 9pt; }
  .rep-table th {
    text-align: left; padding: 2.5mm 3mm; background: #f3f0fa; color: #2a1a5a;
    font-weight: 700; border-bottom: 1.5pt solid #5b34c9; font-size: 8pt;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .rep-table td { padding: 2.2mm 3mm; border-bottom: 0.5pt solid #ececec; color: #2a2440; }
  .rep-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .rep-table tfoot td { font-weight: 800; color: #14111f; border-top: 1.5pt solid #5b34c9; border-bottom: none; }
  .rep-pill { display: inline-block; padding: 0.6mm 2mm; border-radius: 1.5mm; font-size: 7.5pt; font-weight: 800; }

  .rep-footer {
    padding: 8mm 18mm; text-align: center; font-size: 8pt; color: #9b96a8;
    border-top: 0.5pt solid #eee;
  }

  @media print {
    @page { size: A4; margin: 0; }
    html, body { background: white; }
    .no-print { display: none !important; }
    .rep { max-width: none; }
    .rep-section { break-inside: avoid; }
    .rep-card, .rep-kpi, .rep-table tr { break-inside: avoid; }
    .rep-table thead { display: table-header-group; }
  }
`;
