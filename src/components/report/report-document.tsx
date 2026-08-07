// The branded Monthly Report "paper" — renders the fixed structure from a
// snapshot as an at-a-glance dashboard. Self-contained (own <style>) so it
// renders identically in the internal view, the print/PDF route, and the public
// client preview.
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
import { formatDate } from "@/lib/dates";
import { ReportTrendChart } from "./report-trend-chart";
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

function DeltaChip({ delta }: { delta: MetricDelta | null }) {
  if (!delta) return null;
  const cls = delta.dir === "flat" ? "flat" : delta.good ? "up" : "down";
  const arrow = delta.dir === "up" ? "▲" : delta.dir === "down" ? "▼" : "·";
  return (
    <span className={`wa-delta ${cls}`}>
      {arrow} {delta.text}
    </span>
  );
}

/** Per-keyword month-over-month position move for the Top Queries table.
 *  change = prevPos − position, so positive = climbed. null = didn't rank last
 *  month (a new keyword). */
function ChangeCell({ change }: { change: number | null }) {
  if (change === null) return <span className="wa-kwnew">novo</span>;
  if (change > 0.1) return <span className="wa-up">▲ {change.toFixed(1)}</span>;
  if (change < -0.1) return <span className="wa-down-t">▼ {Math.abs(change).toFixed(1)}</span>;
  return <span className="wa-flat-t">—</span>;
}

/** Month-over-month move in WHOLE places, for the SE Ranking table. Positions
 *  there are exact SERP ranks, not averages, so "▲ 3" reads better than
 *  "▲ 3.0". null = no earlier check to compare against (not a new keyword). */
function PlaceCell({ change }: { change: number | null }) {
  if (change === null) return <span className="wa-flat-t">—</span>;
  if (change > 0) return <span className="wa-up">▲ {change}</span>;
  if (change < 0) return <span className="wa-down-t">▼ {Math.abs(change)}</span>;
  return <span className="wa-flat-t">—</span>;
}

/** A headline KPI tile for the hero band. Hidden in client variant when the
 *  value is pending (nothing validated to show yet). */
function KpiTile({
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
  const isNa = Boolean(m.manualNa);
  const pending = m.value === null && !isNa;
  if (pending && variant === "client") return null;
  return (
    <div className="wa-kpi">
      <div className="wa-kpi-l">{label}</div>
      <div className="wa-kpi-v">
        {pending ? <span className="wa-kpi-dash">—</span> : isNa ? "N/A" : formatValue(m, lang)}
      </div>
      {!pending && !isNa && <DeltaChip delta={metricDelta(m, lang)} />}
      {pending && <div className="wa-kpi-note">{pendingNote(m, lang)}</div>}
    </div>
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
  const isNa = Boolean(m.manualNa);
  const pending = m.value === null && !isNa;
  if (pending && variant === "client") return null;
  const note = pendingNote(m, lang);
  return (
    <div className="wa-mrow">
      <span className="wa-ml">{label}</span>
      <span className="wa-mr">
        {pending ? (
          <span className="wa-pending">{note}</span>
        ) : isNa ? (
          <span className="wa-na">N/A</span>
        ) : (
          <>
            <span className="wa-mv">{formatValue(m, lang)}</span>
            <DeltaChip delta={metricDelta(m, lang)} />
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
    (c) => variant === "internal" || c.metric.value !== null || c.metric.manualNa,
  );
  const maxChannel = Math.max(
    1,
    ...visibleChannels.map((c) => c.metric.value ?? 0),
  );

  const org = snapshot.organic;
  const gsc = snapshot.gsc;
  // Optional on the snapshot — reports generated before v76.15 have none.
  const coverage = snapshot.coverage;
  const allTargetRanks = gsc.targetRanks ?? [];
  const rankedTargets = allTargetRanks.filter((k) => k.position !== null);
  // O CLIENTE VÊ SÓ AS QUE RANKEIAM (v76.32). Uma tabela de trinta linhas onde
  // metade diz «ainda não rankeia» não lê como trabalho em curso — lê como
  // falha, e rouba o olho às que subiram. O consultor continua a ver a lista
  // inteira na variante interna, que é onde a lacuna é acionável.
  const targetRanks = variant === "internal" ? allTargetRanks : rankedTargets;
  // True SERP positions — absent on reports for clients with no synced
  // SE Ranking project, and on every report generated before v76.26.
  const seRanking = snapshot.seRanking;
  const srAllRanks = seRanking?.ranks ?? [];
  const srRanked = srAllRanks.filter((k) => k.position !== null);
  // Mesma regra: fora do top 100 é «ainda não», não é um resultado.
  const srVisibleRanks = variant === "internal" ? srAllRanks : srRanked;
  const srTop = (n: number) =>
    srRanked.filter((k) => (k.position ?? Infinity) <= n).length;
  const srLocalPack = srAllRanks.filter((k) => k.inLocalPack).length;
  const ai = snapshot.ai;
  const gbp = snapshot.gbp;
  // Per-listing breakdown — only on multi-unit clients (and absent on every
  // report generated before v76.28). In the client variant a listing with
  // nothing validated is dropped, like every other pending block.
  const gbpProfiles = (gbp.profiles ?? []).filter(
    (p) =>
      variant === "internal" ||
      [p.websiteClicks, p.directions, p.callClicks].some(
        (m) => m.value !== null || m.manualNa,
      ),
  );

  // Hero KPIs — the month's headline numbers. Order = what the client cares
  // about most: leads first, then reach, then search performance.
  const kpiDefs: { label: string; m: ReportMetric }[] = [
    { label: t("Leads geradas", "Leads generated"), m: leadTotal },
    { label: t("Utilizadores orgânicos", "Organic users"), m: org.users },
    { label: t("Clicks no Google", "Google clicks"), m: gsc.clicks },
    { label: t("Posição média", "Avg. position"), m: gsc.position },
  ];
  const kpis = kpiDefs.filter(
    (k) => variant === "internal" || k.m.value !== null || k.m.manualNa,
  );

  const showTopTables =
    gsc.topQueries.length > 0 || gsc.topPages.length > 0 || variant === "internal";
  const showAi = ai.sources.length > 0 || variant === "internal";

  return (
    <div className="wa-report">
      <style>{CSS}</style>

      {/* Cover */}
      <header className="wa-cover" style={{ background: GRAD }}>
        <div className="wa-cover-top">
          <div className="wa-cbrand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wa-cglyph" src="/wonder-ads-butterfly.png" alt="Wonder Ads" />
            Wonder Ads
          </div>
          <span className="wa-cbadge">{snapshot.periodLabel}</span>
        </div>
        <h1 className="wa-ctitle">{t("Relatório de SEO & Leads", "SEO & Leads Report")}</h1>
        <div className="wa-cmeta">{snapshot.clientTitle}</div>
        <div className="wa-cconsult">
          {t("Consultor", "Consultant")}: {snapshot.consultant.name}
          {snapshot.consultant.email ? ` · ${snapshot.consultant.email}` : ""}
        </div>
        {coverage?.partial && (
          <div className="wa-cpartial">
            {t(
              `Relatório parcial — cobre os dias 1 a ${coverage.days} de ${coverage.monthDays}. Todas as comparações usam o mesmo número de dias do período anterior.`,
              `Partial report — covers days 1–${coverage.days} of ${coverage.monthDays}. Every comparison uses the same number of days from the prior period.`,
            )}
          </div>
        )}
      </header>

      {/* Hero KPI band */}
      {kpis.length > 0 && (
        <section className="wa-kpis">
          {kpis.map((k) => (
            <KpiTile key={k.label} label={k.label} m={k.m} lang={lang} variant={variant} />
          ))}
        </section>
      )}

      {/* Executive Summary — the wins, up front */}
      {snapshot.execSummary.length > 0 && (
        <section className="wa-sec">
          <div className="wa-exec-card">
            <div className="wa-label wa-label-on-tint">{t("Destaques do mês", "Highlights of the month")}</div>
            <ul className="wa-exec">
              {snapshot.execSummary.map((b, i) => (
                <li key={i}>{boldParts(b, `ex${i}`)}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Evolução — vem logo a seguir ao sumário porque é a resposta à
          primeira pergunta que o cliente faz («isto está a crescer?»), e
          nenhum número de um mês sozinho a responde. */}
      {snapshot.trend && (
        <section className="wa-sec wa-sec-trend">
          <div className="wa-label">{t("Evolução", "Trend")}</div>
          <h2 className="wa-h2">
            {t("Os últimos 12 meses", "The last 12 months")}
          </h2>
          <p className="wa-method">
            {t(
              "Cada linha tem a sua própria escala e começa no zero. Onde a linha não existe, ainda não havia medição nesse mês.",
              "Each line has its own scale and starts at zero. Where the line is missing, there was no measurement that month yet.",
            )}
          </p>
          <ReportTrendChart trend={snapshot.trend} lang={lang} />
        </section>
      )}

      {/* Leads breakdown */}
      <section className="wa-sec">
        <div className="wa-label">{t("Leads por canal", "Leads by channel")}</div>
        <h2 className="wa-h2">{t("De onde vieram os contactos", "Where the contacts came from")}</h2>
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
            <span className="wa-bignum-l">{t("leads no total", "leads in total")}</span>
            <DeltaChip delta={leadDelta} />
          </div>
        )}
        {visibleChannels.length > 0 && (
          <div className="wa-chan">
            {visibleChannels.map((c) => {
              const isNa = Boolean(c.metric.manualNa);
              const pending = c.metric.value === null && !isNa;
              return (
                <div className="wa-chan-row" key={c.key}>
                  <span className="wa-cn">{c.label}</span>
                  <span className="wa-cbar">
                    <i style={{ width: `${((c.metric.value ?? 0) / maxChannel) * 100}%`, background: GRAD }} />
                  </span>
                  <span className="wa-cv">
                    {pending ? (
                      <span className="wa-pending">{pendingNote(c.metric, lang)}</span>
                    ) : isNa ? (
                      <span className="wa-na">N/A</span>
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

      {/* GBP + Organic side by side */}
      <section className="wa-sec">
        <div className="wa-two">
          <div className="wa-card">
            <div className="wa-label">Google Business Profile</div>
            <h3 className="wa-h3">
              {gbpProfiles.length > 1
                ? t(
                    `Cliques & direções · ${gbpProfiles.length} fichas`,
                    `Clicks & directions · ${gbpProfiles.length} listings`,
                  )
                : t("Cliques & direções", "Clicks & directions")}
            </h3>
            <MetricRow label={t("Cliques p/ website", "Website clicks")} m={gbp.websiteClicks} lang={lang} variant={variant} />
            <MetricRow label={t("Pedidos de direções", "Direction requests")} m={gbp.directions} lang={lang} variant={variant} />
            <MetricRow label={t("Cliques p/ ligar", "Call clicks")} m={gbp.callClicks} lang={lang} variant={variant} />

            {/* Breakdown por unidade — só existe quando o cliente tem mais do
                que uma ficha. O total acima é a soma de todas. */}
            {gbpProfiles.length > 1 && (
              <div className="wa-gbp-units">
                <div className="wa-gbp-units-l">
                  {t("Por ficha", "Per listing")}
                </div>
                {gbpProfiles.map((p) => (
                  <div className="wa-gbp-unit" key={p.id}>
                    <div className="wa-gbp-unit-n">{p.label}</div>
                    <MetricRow label={t("Cliques p/ website", "Website clicks")} m={p.websiteClicks} lang={lang} variant={variant} />
                    <MetricRow label={t("Pedidos de direções", "Direction requests")} m={p.directions} lang={lang} variant={variant} />
                    <MetricRow label={t("Cliques p/ ligar", "Call clicks")} m={p.callClicks} lang={lang} variant={variant} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="wa-card">
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
        </div>
      </section>

      {/* AI Visibility */}
      {showAi && (
        <section className="wa-sec">
          <div className="wa-label">AI Visibility</div>
          <h3 className="wa-h3">{t("Visitantes vindos de assistentes de IA", "Visitors from AI assistants")}</h3>
          <p className="wa-method">
            {t(
              "Sessões cujo referral corresponde a domínios de assistentes de IA (ChatGPT, Gemini, Perplexity, Claude, Copilot…), segmentadas no Google Analytics 4 pela origem da sessão.",
              "Sessions whose referral matches AI-assistant domains (ChatGPT, Gemini, Perplexity, Claude, Copilot…), segmented in Google Analytics 4 by session source.",
            )}
          </p>
          {ai.sources.length === 0 ? (
            <p className="wa-pending">
              {ai.totalSessions.value === 0
                ? t("Sem tráfego de assistentes de IA neste mês.", "No AI-assistant traffic this month.")
                : t("A aguardar dados de AI Visibility.", "Awaiting AI Visibility data.")}
            </p>
          ) : (
            <>
              <div className="wa-ai-total">
                <span className="wa-ai-total-v">
                  {formatRaw(ai.totalSessions.value ?? 0, "count", lang)}
                </span>
                <span className="wa-ai-total-l">
                  {t("sessões de assistentes de IA no total", "total AI-assistant sessions")}
                </span>
              </div>
              <div className="wa-ai-grid">
                {[...ai.sources]
                  .sort((a, b) => b.sessions - a.sessions)
                  .map((s) => (
                    <div className="wa-ai-card" key={s.source}>
                      <div className="wa-ai-src">◆ {s.label}</div>
                      <div className="wa-ai-sess">{formatRaw(s.sessions, "count", lang)}</div>
                      <div className="wa-ai-sub">
                        {formatRaw(s.users, "count", lang)} {t("utiliz.", "users")} ·{" "}
                        {formatRaw(s.engagedSessions, "count", lang)} {t("c/ engagement", "engaged")}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Top Queries & Pages */}
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
                      <th className="n">{t("Δ mês", "MoM Δ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gsc.topQueries.slice(0, 10).map((q) => (
                      <tr key={q.query}>
                        <td>{q.query}</td>
                        <td className="n">{formatRaw(q.clicks, "count", lang)}</td>
                        <td className="n">{formatRaw(q.position, "position", lang)}</td>
                        <td className="n"><ChangeCell change={q.change} /></td>
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

      {/* Keywords & Positions (month-end footprint) */}
      {gsc.keywordStats && (gsc.keywordStats.total > 0 || variant === "internal") && (
        <section className="wa-sec">
          <div className="wa-label">{t("Keywords & Posições", "Keywords & Positions")}</div>
          <h3 className="wa-h3">{t("Presença nas pesquisas (fim do mês)", "Search presence (month-end)")}</h3>
          <p className="wa-method">
            {t(
              "Com base nas queries com impressões no Google Search Console durante o mês.",
              "Based on Google Search Console queries with impressions during the month.",
            )}
          </p>
          <div className="wa-kstats">
            <div className="wa-kstat">
              <span className="wa-kv">{formatRaw(gsc.keywordStats.total, "count", lang)}</span>
              <span className="wa-kl">{t("keywords c/ impressões", "keywords w/ impressions")}</span>
            </div>
            <div className="wa-kstat">
              <span className="wa-kv">{formatRaw(gsc.keywordStats.top3, "count", lang)}</span>
              <span className="wa-kl">Top 3</span>
            </div>
            <div className="wa-kstat">
              <span className="wa-kv">{formatRaw(gsc.keywordStats.top10, "count", lang)}</span>
              <span className="wa-kl">Top 10</span>
            </div>
            <div className="wa-kstat">
              <span className="wa-kv">{formatRaw(gsc.keywordStats.top20, "count", lang)}</span>
              <span className="wa-kl">Top 20</span>
            </div>
            <div className="wa-kstat">
              <span className="wa-kv">{gsc.keywordStats.avgPosition.toFixed(1)}</span>
              <span className="wa-kl">{t("posição média", "avg position")}</span>
            </div>
            {typeof gsc.keywordStats.newKeywords === "number" && (
              <div className="wa-kstat wa-kstat-new">
                <span className="wa-kv">+{formatRaw(gsc.keywordStats.newKeywords, "count", lang)}</span>
                <span className="wa-kl">{t("novas keywords", "new keywords")}</span>
              </div>
            )}
          </div>
          {gsc.topMovers.length > 0 && (
            <div className="wa-tblwrap" style={{ marginTop: "1rem" }}>
              <h3 className="wa-h3">{t("Maiores subidas de posição", "Biggest position gains")}</h3>
              <table className="wa-qtable">
                <thead>
                  <tr>
                    <th>Query</th>
                    <th className="n">{t("Posição", "Position")}</th>
                    <th className="n">{t("Subida", "Gain")}</th>
                  </tr>
                </thead>
                <tbody>
                  {gsc.topMovers.map((m) => (
                    <tr key={m.query}>
                      <td>{m.query}</td>
                      <td className="n">{m.position.toFixed(1)}</td>
                      <td className="n wa-up">▲ {m.change.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Target keywords — every keyword we're working, with its live rank */}
      {targetRanks.length > 0 && (
        <section className="wa-sec">
          <div className="wa-label">
            {t("Keywords Trabalhadas", "Target Keywords")}
          </div>
          <h3 className="wa-h3">
            {variant === "internal"
              ? t(
                  `Posição atual de cada keyword (${targetRanks.length})`,
                  `Current position for every keyword (${targetRanks.length})`,
                )
              : t(
                  `Keywords do plano já com posição na Google (${targetRanks.length})`,
                  `Plan keywords already holding a Google position (${targetRanks.length})`,
                )}
          </h3>
          <p className="wa-method">
            {variant === "internal"
              ? t(
                  "Posição média no Google durante o mês, para cada keyword do plano. «Ainda não rankeia» significa que a keyword não registou impressões neste período — estas linhas não vão para o relatório do cliente.",
                  "Average Google position during the month, for every keyword in the plan. “Not ranking yet” means the keyword recorded no impressions in this period — these rows don't reach the client's report.",
                )
              : t(
                  "Posição média no Google durante o mês, para cada keyword do plano já com presença nos resultados.",
                  "Average Google position during the month, for every keyword in the plan already showing up in the results.",
                )}
          </p>
          <div className="wa-kstats">
            <div className="wa-kstat">
              <span className="wa-kv">{formatRaw(rankedTargets.length, "count", lang)}</span>
              <span className="wa-kl">{t("a rankear", "ranking")}</span>
            </div>
            <div className="wa-kstat">
              <span className="wa-kv">
                {formatRaw(
                  targetRanks.filter((k) => k.position !== null && k.position <= 3).length,
                  "count",
                  lang,
                )}
              </span>
              <span className="wa-kl">Top 3</span>
            </div>
            <div className="wa-kstat">
              <span className="wa-kv">
                {formatRaw(
                  targetRanks.filter((k) => k.position !== null && k.position <= 10).length,
                  "count",
                  lang,
                )}
              </span>
              <span className="wa-kl">Top 10</span>
            </div>
            {/* «Por conquistar» é uma métrica de gestão, não de resultado —
                fica na vista interna. */}
            {variant === "internal" && (
              <div className="wa-kstat">
                <span className="wa-kv">
                  {formatRaw(
                    allTargetRanks.length - rankedTargets.length,
                    "count",
                    lang,
                  )}
                </span>
                <span className="wa-kl">{t("por conquistar", "still to win")}</span>
              </div>
            )}
          </div>
          <div className="wa-tblwrap" style={{ marginTop: "1rem" }}>
            <table className="wa-qtable">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th className="n">{t("Posição", "Position")}</th>
                  <th className="n">{t("Δ mês", "MoM Δ")}</th>
                  <th className="n">{t("Impressões", "Impressions")}</th>
                  <th className="n">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {targetRanks.map((k) => (
                  <tr key={k.keyword}>
                    <td>
                      {k.keyword}
                      {k.isNew && (
                        <span className="wa-kw-new">{t("novo", "new")}</span>
                      )}
                    </td>
                    <td className="n">
                      {k.position === null ? (
                        <span className="wa-pending">
                          {t("ainda não rankeia", "not ranking yet")}
                        </span>
                      ) : (
                        k.position.toFixed(1)
                      )}
                    </td>
                    <td className="n">
                      <ChangeCell change={k.change} />
                    </td>
                    <td className="n">{formatRaw(k.impressions, "count", lang)}</td>
                    <td className="n">{formatRaw(k.clicks, "count", lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* True SERP positions (SE Ranking) — the same target keywords as the
          table above, but checked against the real Google results page rather
          than averaged over the impressions GSC happened to serve. */}
      {seRanking && srVisibleRanks.length > 0 && (
        <section className="wa-sec">
          <div className="wa-label">
            {t("Ranking Real na Google", "Live Google Ranking")}
          </div>
          <h3 className="wa-h3">
            {t(
              `Posição verificada de cada keyword (${srVisibleRanks.length})`,
              `Verified position for every keyword (${srVisibleRanks.length})`,
            )}
          </h3>
          <p className="wa-method">
            {seRanking.outsidePeriod
              ? t(
                  `Posição real na página de resultados da Google, verificada a ${formatDate(seRanking.checkedOn)}. A monitorização começou depois deste mês, por isso mostramos a posição mais recente — a variação mensal fica disponível a partir do próximo relatório.`,
                  `Actual position on Google's results page, checked on ${formatDate(seRanking.checkedOn)}. Tracking started after this month, so we show the most recent check — month-over-month movement becomes available from the next report.`,
                )
              : t(
                  `Posição real na página de resultados da Google, verificada a ${formatDate(seRanking.checkedOn)}. Ao contrário da tabela acima (que é uma média das impressões), esta é a posição em que a keyword aparece de facto.`,
                  `Actual position on Google's results page, checked on ${formatDate(seRanking.checkedOn)}. Unlike the table above (an average over impressions), this is where the keyword actually appears.`,
                )}
          </p>
          <div className="wa-kstats">
            <div className="wa-kstat">
              <span className="wa-kv">{formatRaw(srRanked.length, "count", lang)}</span>
              <span className="wa-kl">{t("no top 100", "in top 100")}</span>
            </div>
            <div className="wa-kstat">
              <span className="wa-kv">{formatRaw(srTop(3), "count", lang)}</span>
              <span className="wa-kl">Top 3</span>
            </div>
            <div className="wa-kstat">
              <span className="wa-kv">{formatRaw(srTop(10), "count", lang)}</span>
              <span className="wa-kl">Top 10</span>
            </div>
            <div className="wa-kstat">
              <span className="wa-kv">{formatRaw(srTop(20), "count", lang)}</span>
              <span className="wa-kl">Top 20</span>
            </div>
            {srLocalPack > 0 && (
              <div className="wa-kstat wa-kstat-new">
                <span className="wa-kv">{formatRaw(srLocalPack, "count", lang)}</span>
                <span className="wa-kl">{t("no mapa", "in map pack")}</span>
              </div>
            )}
          </div>
          <div className="wa-tblwrap" style={{ marginTop: "1rem" }}>
            <table className="wa-qtable">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th className="n">{t("Posição", "Position")}</th>
                  <th className="n">{t("Δ mês", "MoM Δ")}</th>
                  <th className="n">{t("Pesquisas/mês", "Searches/mo")}</th>
                </tr>
              </thead>
              <tbody>
                {srVisibleRanks.map((k) => (
                  <tr key={k.keyword}>
                    <td>
                      {k.keyword}
                      {k.inLocalPack && (
                        <span className="wa-kw-map">{t("mapa", "map")}</span>
                      )}
                    </td>
                    <td className="n">
                      {k.position === null ? (
                        <span className="wa-pending">
                          {t("fora do top 100", "outside top 100")}
                        </span>
                      ) : (
                        k.position
                      )}
                    </td>
                    <td className="n">
                      <PlaceCell change={k.change} />
                    </td>
                    <td className="n">
                      {k.volume === null ? "—" : formatRaw(k.volume, "count", lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Notes */}
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

      {/* Footer band */}
      <footer className="wa-foot">
        <span className="wa-foot-brand">Wonder Ads</span>
        <span className="wa-foot-sub">
          {t("Relatório mensal de SEO & Leads", "Monthly SEO & Leads report")} · {snapshot.periodLabel}
        </span>
      </footer>
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
.wa-report{--ink:#17162d;--muted:#6d6b86;--line:rgba(23,22,45,.08);--violet:#783df5;--plum:#8a4fd0;--tint:#f7f5fe;--up:#0f8f62;--down:#c93a52;
  background:var(--tint);color:var(--ink);border-radius:16px;overflow:hidden;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  box-shadow:0 24px 70px -34px rgba(23,22,45,.5);border:1px solid rgba(23,22,45,.06);}
.wa-report *{box-sizing:border-box;}

/* Cover */
.wa-cover{position:relative;color:#fff;padding:2.1rem 1.9rem 2.3rem;overflow:hidden;}
.wa-cover::after{content:"";position:absolute;right:-70px;top:-70px;width:230px;height:230px;border-radius:50%;
  background:radial-gradient(circle at center,rgba(255,255,255,.22),transparent 68%);pointer-events:none;}
.wa-cover-top{display:flex;align-items:center;justify-content:space-between;gap:1rem;position:relative;z-index:1;}
.wa-cbrand{display:flex;align-items:center;gap:.55rem;font-weight:700;font-size:.95rem;letter-spacing:.01em;}
.wa-cglyph{width:30px;height:30px;border-radius:8px;background:#fff;padding:4px;object-fit:contain;display:inline-block;box-shadow:0 4px 12px -4px rgba(0,0,0,.35);}
.wa-cbadge{display:inline-block;padding:.32rem .7rem;border-radius:999px;font-size:.72rem;font-weight:700;
  background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);font-variant-numeric:tabular-nums;backdrop-filter:blur(2px);}
.wa-ctitle{margin:1.5rem 0 .3rem;font-size:1.7rem;letter-spacing:-.025em;font-weight:800;line-height:1.05;position:relative;z-index:1;}
.wa-cmeta{font-size:1rem;font-weight:600;opacity:.97;position:relative;z-index:1;}
.wa-cconsult{margin-top:.55rem;font-size:.72rem;opacity:.85;position:relative;z-index:1;}

/* Hero KPI band */
.wa-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem;padding:1.15rem 1.6rem;}
.wa-kpi{position:relative;background:#fff;border:1px solid var(--line);border-radius:12px;padding:.9rem .95rem 1rem;overflow:hidden;
  box-shadow:0 8px 24px -20px rgba(23,22,45,.55);}
.wa-kpi::before{content:"";position:absolute;left:0;top:0;height:3px;width:100%;background:${"linear-gradient(90deg,#343ED7,#783DF5,#C535C9)"};}
.wa-kpi-l{font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--plum);}
.wa-kpi-v{font-size:1.9rem;font-weight:800;letter-spacing:-.03em;line-height:1.05;margin:.35rem 0 .4rem;color:var(--ink);font-variant-numeric:tabular-nums;}
.wa-kpi-dash{color:#c7c2d6;}
.wa-kpi-note{font-size:.66rem;color:#a08fb8;font-style:italic;}

/* Sections */
.wa-sec{padding:1.25rem 1.6rem;}
.wa-sec + .wa-sec{border-top:1px solid var(--line);}
.wa-label{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--plum);font-weight:700;}
.wa-h2{margin:.35rem 0 .7rem;font-size:1.1rem;letter-spacing:-.015em;font-weight:700;}
.wa-h3{margin:.2rem 0 .6rem;font-size:.95rem;letter-spacing:-.01em;font-weight:700;}

/* Executive summary — wins ribbon */
.wa-exec-card{background:linear-gradient(135deg,rgba(52,62,215,.07),rgba(197,53,201,.07));
  border:1px solid rgba(120,61,245,.16);border-radius:14px;padding:1.05rem 1.15rem;}
.wa-label-on-tint{color:#6b34c9;}
.wa-exec{margin:.55rem 0 0;padding:0;display:grid;gap:.5rem;}
.wa-exec li{list-style:none;padding-left:1.3rem;position:relative;font-size:.9rem;color:#2f2e3d;line-height:1.5;}
.wa-exec li::before{content:"◆";position:absolute;left:0;color:var(--violet);font-size:.62rem;top:.28rem;}

/* Leads */
.wa-bignum{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;margin-bottom:.4rem;}
.wa-bignum .wa-v{font-size:2.4rem;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1;}
.wa-bignum-l{font-size:.82rem;color:var(--muted);font-weight:600;}
.wa-delta{display:inline-flex;align-items:center;gap:.25rem;font-size:.74rem;font-weight:700;padding:.14rem .45rem;border-radius:6px;font-variant-numeric:tabular-nums;white-space:nowrap;}
.wa-delta.up{color:var(--up);background:rgba(15,157,107,.12);}
.wa-delta.down{color:var(--down);background:rgba(209,67,90,.12);}
.wa-delta.flat{color:#6d6b86;background:rgba(23,22,45,.06);}
.wa-chan{display:grid;gap:.55rem;margin-top:1rem;}
.wa-chan-row{display:grid;grid-template-columns:160px 1fr 74px;gap:.65rem;align-items:center;font-size:.8rem;}
.wa-cn{color:#45435c;}
.wa-cbar{height:9px;border-radius:5px;background:rgba(23,22,45,.06);overflow:hidden;}
.wa-cbar i{display:block;height:100%;border-radius:5px;}
.wa-cv{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;}

/* Cards / two-col */
.wa-two{display:grid;grid-template-columns:1fr 1fr;gap:.9rem;}
.wa-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:1rem 1.1rem;box-shadow:0 8px 24px -22px rgba(23,22,45,.5);}
.wa-mrow{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.34rem 0;font-size:.8rem;border-bottom:1px dashed var(--line);}
.wa-mrow:last-of-type{border-bottom:none;}
.wa-ml{color:#45435c;}
.wa-mr{display:flex;align-items:center;gap:.45rem;font-weight:700;font-variant-numeric:tabular-nums;}
.wa-nvr{margin-top:.6rem;font-size:.78rem;color:#45435c;font-variant-numeric:tabular-nums;}
/* Breakdown por ficha GBP (clientes com mais do que uma unidade) */
.wa-gbp-units{margin-top:.85rem;border-top:1px solid var(--line);padding-top:.7rem;}
.wa-gbp-units-l{font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;color:var(--plum);font-weight:700;margin-bottom:.4rem;}
.wa-gbp-unit{background:rgba(120,61,245,.035);border:1px solid var(--line);border-radius:9px;padding:.5rem .7rem;margin-bottom:.45rem;break-inside:avoid;}
.wa-gbp-unit:last-child{margin-bottom:0;}
.wa-gbp-unit-n{font-size:.76rem;font-weight:700;color:#2c2a45;margin-bottom:.15rem;}
.wa-gbp-unit .wa-mrow{font-size:.76rem;padding:.24rem 0;}
.wa-pending{color:#a08fb8;font-style:italic;font-weight:500;font-size:.76rem;}
.wa-na{color:#7a7890;font-weight:600;font-size:.76rem;}
.wa-pending-lg{color:#a08fb8;font-style:italic;font-size:.85rem;margin:.3rem 0;}
.wa-method{margin:.15rem 0 .8rem;font-size:.74rem;line-height:1.5;color:var(--muted);max-width:64ch;}

/* Evolução — small multiples, um painel por métrica, cada um com a sua escala */
.wa-trend{display:grid;gap:.7rem;}
.wa-trend-panel{background:#fff;border:1px solid var(--line);border-radius:12px;padding:.75rem .9rem .55rem;
  box-shadow:0 8px 24px -22px rgba(23,22,45,.5);break-inside:avoid;page-break-inside:avoid;}
.wa-trend-head{display:flex;align-items:baseline;justify-content:space-between;gap:.6rem;margin-bottom:.15rem;}
.wa-trend-name{font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--plum);}
.wa-trend-last{font-size:1.05rem;font-weight:800;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums;}
.wa-trend-svg{display:block;width:100%;height:auto;}
.wa-trend-tick{font-size:8px;fill:#a09eb4;font-variant-numeric:tabular-nums;letter-spacing:.02em;}
.wa-trend-max{font-size:8px;fill:#b3aec4;font-weight:700;font-variant-numeric:tabular-nums;}
.wa-sec-trend{break-inside:avoid;page-break-inside:avoid;}

/* AI */
.wa-ai-total{display:flex;align-items:baseline;gap:.5rem;margin:.2rem 0 .85rem;}
.wa-ai-total-v{font-size:1.7rem;font-weight:800;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums;}
.wa-ai-total-l{font-size:.78rem;color:#45435c;}
.wa-ai-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.65rem;}
.wa-ai-card{border:1px solid rgba(120,61,245,.16);background:#fff;border-radius:11px;padding:.75rem .85rem;box-shadow:0 8px 22px -22px rgba(23,22,45,.5);}
.wa-ai-src{font-size:.72rem;font-weight:700;color:#6b34c9;}
.wa-ai-sess{font-size:1.4rem;font-weight:800;color:var(--ink);line-height:1.1;margin:.15rem 0 .1rem;font-variant-numeric:tabular-nums;}
.wa-ai-sub{font-size:.66rem;color:var(--muted);font-variant-numeric:tabular-nums;}

/* Keyword stats */
.wa-kstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.65rem;margin-top:.35rem;}
.wa-kstat{border:1px solid var(--line);border-left:3px solid var(--violet);border-radius:10px;padding:.7rem .8rem;background:#fff;box-shadow:0 8px 22px -22px rgba(23,22,45,.5);}
.wa-kv{display:block;font-size:1.55rem;font-weight:800;color:var(--ink);line-height:1.05;letter-spacing:-.02em;font-variant-numeric:tabular-nums;}
.wa-kl{display:block;margin-top:.2rem;font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:var(--plum);font-weight:700;}
.wa-up{color:var(--up) !important;}
.wa-down-t{color:var(--down);font-weight:700;}
.wa-flat-t{color:#a5a2b8;}
.wa-kwnew{display:inline-block;font-size:.6rem;font-weight:800;letter-spacing:.02em;color:var(--up);background:rgba(15,157,107,.12);padding:.05rem .34rem;border-radius:5px;text-transform:uppercase;}
.wa-kstat-new{border-left-color:var(--up);}

/* Tables */
.wa-two-tables{display:grid;grid-template-columns:1fr 1fr;gap:1.4rem;margin-top:.4rem;}
.wa-tblwrap{min-width:0;overflow-x:auto;}
.wa-qtable{width:100%;border-collapse:collapse;font-size:.75rem;}
.wa-qtable th{text-align:left;color:var(--plum);font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;padding:.32rem .3rem;border-bottom:1px solid rgba(23,22,45,.12);}
.wa-qtable th.n,.wa-qtable td.n{text-align:right;font-variant-numeric:tabular-nums;}
.wa-qtable td{padding:.34rem .3rem;border-bottom:1px solid var(--line);color:#34333f;}
.wa-qtable tbody tr:nth-child(even){background:rgba(120,61,245,.03);}
.wa-qtable td.n{font-weight:700;color:var(--ink);}
/* "novo" pill on a target keyword that started ranking this month. */
/* Partial-month notice on the cover — must be impossible to miss, because a
   26-day month read as a full one is a wrong conclusion, not a small one. */
.wa-cpartial{margin-top:.6rem;display:inline-block;padding:.32rem .6rem;border-radius:8px;
  background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.32);
  color:#92400e;font-size:.68rem;font-weight:600;line-height:1.4;}
.wa-kw-new{display:inline-block;margin-left:.34rem;padding:0 .3rem;border-radius:6px;
  background:rgba(22,163,74,.12);color:#15803d;font-size:.56rem;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;vertical-align:middle;}
.wa-kw-map{display:inline-block;margin-left:.34rem;padding:0 .3rem;border-radius:6px;
  background:rgba(120,61,245,.12);color:var(--violet);font-size:.56rem;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;vertical-align:middle;}
.wa-notes{font-size:.86rem;color:#34333f;line-height:1.55;white-space:pre-wrap;margin:.3rem 0 0;}

/* Footer */
.wa-foot{display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;
  padding:1.1rem 1.6rem;border-top:1px solid var(--line);background:#fff;}
.wa-foot-brand{font-weight:800;font-size:.9rem;background:${GRAD};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}
.wa-foot-sub{font-size:.72rem;color:var(--muted);font-variant-numeric:tabular-nums;}

@media (max-width:640px){
  .wa-two{grid-template-columns:1fr;}
  .wa-two-tables{grid-template-columns:1fr;}
  .wa-chan-row{grid-template-columns:110px 1fr 60px;}
  .wa-ctitle{font-size:1.45rem;}
}
@media print{
  .wa-report{box-shadow:none;border:none;border-radius:0;background:#fff;}
  .wa-kpi,.wa-card,.wa-ai-card,.wa-kstat{box-shadow:none;}
}
`;
