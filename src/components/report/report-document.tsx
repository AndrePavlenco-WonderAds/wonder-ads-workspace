// The branded Monthly Report "paper" — renders the fixed 8-section structure
// from a snapshot. Self-contained (own <style>) so it renders identically in
// the internal view, the print/PDF route, and the public client preview.
//
// variant "internal": shows pending / não-instrumentado metrics so the
//   consultant knows what to fill. variant "client": clean — pending metrics
//   and empty sections are hidden, per the spec ("sem métricas não
//   instrumentadas — apenas dados validados").

import {
  formatValue,
  formatRaw,
  metricDelta,
  pendingNote,
  type MetricDelta,
} from "@/lib/report/report-format";
import type {
  MonthlyReportSnapshot,
  ReportMetric,
} from "@/lib/report/report-types";

const GRAD = "linear-gradient(135deg,#343ED7 0%,#783DF5 53%,#C535C9 100%)";

type Variant = "internal" | "client";

function boldParts(text: string, keyBase: string) {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={`${keyBase}-${i}`}>{part}</strong> : <span key={`${keyBase}-${i}`}>{part}</span>,
  );
}

function DeltaChip({ delta, lang }: { delta: MetricDelta | null; lang: "pt" | "en" }) {
  if (!delta) return null;
  const cls = delta.dir === "flat" ? "flat" : delta.good ? "up" : "down";
  const arrow = delta.dir === "up" ? "▲" : delta.dir === "down" ? "▼" : "·";
  return (
    <span className={`wa-delta ${cls}`}>
      {arrow} {delta.text}
    </span>
  );
}

/** One metric line: label + value + delta. Hidden in client variant when the
 *  value is pending. */
function MetricRow({
  label,
  m,
  lang,
  variant,
}: {
  label: string;
  m: ReportMetric;
  lang: "pt" | "en";
  variant: Variant;
}) {
  const pending = m.value === null;
  if (pending && variant === "client") return null;
  const note = pendingNote(m, lang);
  return (
    <div className="wa-mrow">
      <span className="wa-ml">{label}</span>
      <span className="wa-mr">
        {pending ? (
          <span className="wa-pending">{note}</span>
        ) : (
          <>
            <span className="wa-mv">{formatValue(m, lang)}</span>
            <DeltaChip delta={metricDelta(m, lang)} lang={lang} />
          </>
        )}
      </span>
    </div>
  );
}

export function ReportDocument({
  snapshot,
  variant = "internal",
}: {
  snapshot: MonthlyReportSnapshot;
  variant?: Variant;
}) {
  const { lang } = snapshot;
  const pt = lang === "pt";
  const t = (p: string, e: string) => (pt ? p : e);

  const leadTotal = snapshot.leads.total;
  const leadDelta = metricDelta(leadTotal, lang);
  const visibleChannels = snapshot.leads.channels.filter(
    (c) => variant === "internal" || c.metric.value !== null,
  );
  const maxChannel = Math.max(
    1,
    ...visibleChannels.map((c) => c.metric.value ?? 0),
  );

  const org = snapshot.organic;
  const gsc = snapshot.gsc;
  const ai = snapshot.ai;
  const gbp = snapshot.gbp;

  const showTopTables =
    gsc.topQueries.length > 0 || gsc.topPages.length > 0 || variant === "internal";
  const showAi = ai.sources.length > 0 || variant === "internal";

  return (
    <div className="wa-report">
      <style>{CSS}</style>

      {/* 1 — Cover */}
      <header className="wa-cover" style={{ background: GRAD }}>
        <div className="wa-cbrand">
          <span className="wa-cglyph" />
          Wonder Ads
        </div>
        <h1 className="wa-ctitle">{t("Relatório de SEO & Leads", "SEO & Leads Report")}</h1>
        <div className="wa-cmeta">
          {snapshot.clientTitle} · {snapshot.periodLabel}
        </div>
      </header>

      {/* 2 — Executive Summary */}
      {snapshot.execSummary.length > 0 && (
        <section className="wa-sec">
          <div className="wa-label">{t("Resumo Executivo", "Executive Summary")}</div>
          <ul className="wa-exec">
            {snapshot.execSummary.map((b, i) => (
              <li key={i}>{boldParts(b, `ex${i}`)}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 3 — Leads Overview */}
      <section className="wa-sec">
        <div className="wa-label">{t("Leads", "Leads")}</div>
        <h2 className="wa-h2">{t("Total consolidado de leads", "Consolidated lead total")}</h2>
        {leadTotal.value === null ? (
          <p className="wa-pending-lg">
            {t(
              "A aguardar dados — configure os eventos de lead ou preencha manualmente.",
              "Awaiting data — configure lead events or fill in manually.",
            )}
          </p>
        ) : (
          <div className="wa-bignum">
            <span className="wa-v">{formatValue(leadTotal, lang)}</span>
            <DeltaChip delta={leadDelta} lang={lang} />
          </div>
        )}
        {visibleChannels.length > 0 && (
          <div className="wa-chan">
            {visibleChannels.map((c) => {
              const pending = c.metric.value === null;
              return (
                <div className="wa-chan-row" key={c.key}>
                  <span className="wa-cn">{c.label}</span>
                  <span className="wa-cbar">
                    <i style={{ width: `${((c.metric.value ?? 0) / maxChannel) * 100}%`, background: GRAD }} />
                  </span>
                  <span className="wa-cv">
                    {pending ? (
                      <span className="wa-pending">{pendingNote(c.metric, lang)}</span>
                    ) : (
                      formatValue(c.metric, lang)
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4 & 5 — GBP + Organic side by side */}
      <section className="wa-sec wa-two">
        <div>
          <div className="wa-label">{t("Google Business Profile", "Google Business Profile")}</div>
          <h3 className="wa-h3">{t("Cliques & direções", "Clicks & directions")}</h3>
          <MetricRow label={t("Cliques p/ website", "Website clicks")} m={gbp.websiteClicks} lang={lang} variant={variant} />
          <MetricRow label={t("Pedidos de direções", "Direction requests")} m={gbp.directions} lang={lang} variant={variant} />
          <MetricRow label={t("Cliques p/ ligar", "Call clicks")} m={gbp.callClicks} lang={lang} variant={variant} />
        </div>
        <div>
          <div className="wa-label">{t("Tráfego Orgânico", "Organic Traffic")}</div>
          <h3 className="wa-h3">GA4 · GSC</h3>
          <MetricRow label={t("Sessões orgânicas", "Organic sessions")} m={org.sessions} lang={lang} variant={variant} />
          <MetricRow label={t("Utilizadores orgânicos", "Organic users")} m={org.users} lang={lang} variant={variant} />
          <MetricRow label={t("Utilizadores Google orgânico", "Google organic users")} m={org.googleOrganicUsers} lang={lang} variant={variant} />
          <MetricRow label={t("Tempo médio / utilizador", "Avg time / user")} m={org.avgEngagementTimePerUser} lang={lang} variant={variant} />
          <MetricRow label={t("Taxa de engagement", "Engagement rate")} m={org.engagementRate} lang={lang} variant={variant} />
          <MetricRow label={t("Clicks (GSC)", "Clicks (GSC)")} m={gsc.clicks} lang={lang} variant={variant} />
          <MetricRow label={t("Impressões (GSC)", "Impressions (GSC)")} m={gsc.impressions} lang={lang} variant={variant} />
          <MetricRow label={t("Posição média (GSC)", "Avg position (GSC)")} m={gsc.position} lang={lang} variant={variant} />
          <div className="wa-nvr">
            {org.newUsers.value !== null && org.returningUsers.value !== null ? (
              <>
                {t("Novos vs. recorrentes", "New vs. returning")}:{" "}
                <b>{formatRaw(org.newUsers.value, "count", lang)}</b> /{" "}
                <b>{formatRaw(org.returningUsers.value, "count", lang)}</b>
              </>
            ) : variant === "internal" ? (
              <span className="wa-pending">{t("novos vs. recorrentes — sem dados", "new vs. returning — no data")}</span>
            ) : null}
          </div>
        </div>
      </section>

      {/* 6 — AI Visibility */}
      {showAi && (
        <section className="wa-sec">
          <div className="wa-label">AI Visibility</div>
          <h3 className="wa-h3">{t("Sessões atribuídas a LLMs", "Sessions attributed to LLMs")}</h3>
          {ai.sources.length === 0 ? (
            <p className="wa-pending">
              {ai.totalSessions.value === 0
                ? t("Sem tráfego de LLMs neste mês.", "No LLM traffic this month.")
                : t("A aguardar dados de AI Visibility.", "Awaiting AI Visibility data.")}
            </p>
          ) : (
            <div className="wa-aiwrap">
              {[...ai.sources]
                .sort((a, b) => b.sessions - a.sessions)
                .map((s) => (
                  <span className="wa-aichip" key={s.source}>
                    ◆ {s.label} · {formatRaw(s.sessions, "count", lang)}
                  </span>
                ))}
            </div>
          )}
        </section>
      )}

      {/* 7 — Top Queries & Pages */}
      {showTopTables && (
        <section className="wa-sec">
          <div className="wa-label">{t("Top Queries & Páginas", "Top Queries & Pages")}</div>
          <div className="wa-two-tables">
            <div className="wa-tblwrap">
              <h3 className="wa-h3">{t("Top queries (GSC)", "Top queries (GSC)")}</h3>
              {gsc.topQueries.length === 0 ? (
                <p className="wa-pending">{t("Sem dados GSC.", "No GSC data.")}</p>
              ) : (
                <table className="wa-qtable">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th className="n">Clicks</th>
                      <th className="n">Pos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gsc.topQueries.slice(0, 10).map((q) => (
                      <tr key={q.query}>
                        <td>{q.query}</td>
                        <td className="n">{formatRaw(q.clicks, "count", lang)}</td>
                        <td className="n">{formatRaw(q.position, "position", lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="wa-tblwrap">
              <h3 className="wa-h3">{t("Top páginas (GSC)", "Top pages (GSC)")}</h3>
              {gsc.topPages.length === 0 ? (
                <p className="wa-pending">{t("Sem dados GSC.", "No GSC data.")}</p>
              ) : (
                <table className="wa-qtable">
                  <thead>
                    <tr>
                      <th>{t("Página", "Page")}</th>
                      <th className="n">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gsc.topPages.slice(0, 10).map((p) => (
                      <tr key={p.page}>
                        <td>{prettyPath(p.page)}</td>
                        <td className="n">{formatRaw(p.clicks, "count", lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 8 — Notes */}
      {(snapshot.notes.trim() || variant === "internal") && (
        <section className="wa-sec">
          <div className="wa-label">{t("Notas & Próximos Passos", "Notes & Next Steps")}</div>
          {snapshot.notes.trim() ? (
            <p className="wa-notes">{snapshot.notes}</p>
          ) : (
            <p className="wa-pending">{t("Sem notas — adicione o foco do próximo mês.", "No notes — add next month's focus.")}</p>
          )}
        </section>
      )}
    </div>
  );
}

function prettyPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

const CSS = `
.wa-report{background:#fff;color:#1a1a24;border-radius:12px;overflow:hidden;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  box-shadow:0 20px 60px -30px rgba(23,22,45,.45);border:1px solid rgba(0,0,0,.06);}
.wa-report *{box-sizing:border-box;}
.wa-cover{color:#fff;padding:2.2rem 1.9rem;}
.wa-cbrand{display:flex;align-items:center;gap:.5rem;font-weight:700;font-size:.92rem;}
.wa-cglyph{width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,.92);display:inline-block;}
.wa-ctitle{margin:1.5rem 0 .25rem;font-size:1.55rem;letter-spacing:-.02em;font-weight:800;}
.wa-cmeta{font-size:.85rem;opacity:.92;font-variant-numeric:tabular-nums;}
.wa-sec{padding:1.15rem 1.6rem;border-top:1px solid rgba(0,0,0,.07);}
.wa-label{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:#8a4fd0;font-weight:700;}
.wa-h2{margin:.3rem 0 .6rem;font-size:1.05rem;letter-spacing:-.01em;}
.wa-h3{margin:.2rem 0 .55rem;font-size:.95rem;letter-spacing:-.01em;}
.wa-exec{margin:.5rem 0 0;padding:0;display:grid;gap:.4rem;}
.wa-exec li{list-style:none;padding-left:1.15rem;position:relative;font-size:.86rem;color:#34333f;line-height:1.5;}
.wa-exec li::before{content:"◆";position:absolute;left:0;color:#783df5;font-size:.6rem;top:.3rem;}
.wa-bignum{display:flex;align-items:baseline;gap:.7rem;flex-wrap:wrap;margin-bottom:.3rem;}
.wa-bignum .wa-v{font-size:2.1rem;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;}
.wa-delta{display:inline-flex;align-items:center;gap:.25rem;font-size:.76rem;font-weight:700;padding:.12rem .45rem;border-radius:6px;font-variant-numeric:tabular-nums;}
.wa-delta.up{color:#0f8f62;background:rgba(15,157,107,.12);}
.wa-delta.down{color:#c93a52;background:rgba(209,67,90,.12);}
.wa-delta.flat{color:#6d6b86;background:rgba(0,0,0,.05);}
.wa-chan{display:grid;gap:.5rem;margin-top:.9rem;}
.wa-chan-row{display:grid;grid-template-columns:150px 1fr 74px;gap:.6rem;align-items:center;font-size:.78rem;}
.wa-cn{color:#45435c;}
.wa-cbar{height:8px;border-radius:5px;background:rgba(0,0,0,.06);overflow:hidden;}
.wa-cbar i{display:block;height:100%;border-radius:5px;}
.wa-cv{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;}
.wa-two{display:grid;grid-template-columns:1fr 1fr;gap:0;padding:0;}
.wa-two>div{padding:1.15rem 1.6rem;}
.wa-two>div:first-child{border-right:1px solid rgba(0,0,0,.07);}
.wa-mrow{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.3rem 0;font-size:.8rem;border-bottom:1px dashed rgba(0,0,0,.08);}
.wa-mrow:last-child{border-bottom:none;}
.wa-ml{color:#45435c;}
.wa-mr{display:flex;align-items:center;gap:.45rem;font-weight:700;font-variant-numeric:tabular-nums;}
.wa-nvr{margin-top:.6rem;font-size:.78rem;color:#45435c;font-variant-numeric:tabular-nums;}
.wa-pending{color:#a08fb8;font-style:italic;font-weight:500;font-size:.76rem;}
.wa-pending-lg{color:#a08fb8;font-style:italic;font-size:.85rem;margin:.3rem 0;}
.wa-aiwrap{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.3rem;}
.wa-aichip{display:inline-flex;align-items:center;gap:.35rem;font-size:.74rem;padding:.24rem .55rem;border-radius:7px;background:rgba(120,61,245,.08);color:#6b34c9;font-weight:600;font-variant-numeric:tabular-nums;}
.wa-two-tables{display:grid;grid-template-columns:1fr 1fr;gap:1.4rem;margin-top:.4rem;}
.wa-tblwrap{min-width:0;overflow-x:auto;}
.wa-qtable{width:100%;border-collapse:collapse;font-size:.75rem;}
.wa-qtable th{text-align:left;color:#8a4fd0;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;padding:.3rem .3rem;border-bottom:1px solid rgba(0,0,0,.12);}
.wa-qtable th.n,.wa-qtable td.n{text-align:right;font-variant-numeric:tabular-nums;}
.wa-qtable td{padding:.32rem .3rem;border-bottom:1px solid rgba(0,0,0,.06);color:#34333f;}
.wa-qtable td.n{font-weight:700;color:#1a1a24;}
.wa-notes{font-size:.85rem;color:#34333f;line-height:1.55;white-space:pre-wrap;margin:.3rem 0 0;}
@media (max-width:640px){.wa-two{grid-template-columns:1fr;}.wa-two>div:first-child{border-right:none;border-bottom:1px solid rgba(0,0,0,.07);}
  .wa-two-tables{grid-template-columns:1fr;}.wa-chan-row{grid-template-columns:110px 1fr 60px;}}
`;
