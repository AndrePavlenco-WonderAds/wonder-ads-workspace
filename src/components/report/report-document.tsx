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
  formatMoney,
  metricDelta,
  pendingNote,
  type MetricDelta,
} from "@/lib/report/report-format";
import { formatDate } from "@/lib/dates";
import { ReportTrendChart } from "./report-trend-chart";
import { GEO_CSS, ReportGeoSection } from "./report-geo";
import {
  ECOM_METRIC_KEYS,
  type EcomCell,
  type EcomMetricKey,
  type MonthlyReportSnapshot,
  type ReportMetric,
  gbpLeadTotal,
  isGbpChannelKey,
  kwRankChange,
  shownRank,
  websiteLeadTotal,
  type KwRankSource,
  type KwRankValue,
} from "@/lib/report/report-types";

const GRAD = "linear-gradient(135deg,#343ED7 0%,#783DF5 53%,#C535C9 100%)";

type Variant = "internal" | "client";

/** Links clicáveis nas notas (v77.9) — é lá que o consultor cola os reports
 *  do Searchable. O texto mostrado é o domínio + caminho, curto, para um
 *  URL de 200 caracteres não engolir o parágrafo. */
const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'")\]])/g;
function shortUrl(u: string): string {
  try {
    const x = new URL(u);
    const path = x.pathname === "/" ? "" : x.pathname;
    const shown = x.hostname.replace(/^www\./, "") + path;
    return shown.length > 64 ? `${shown.slice(0, 62)}…` : shown;
  } catch {
    return u;
  }
}
function linkify(text: string) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={`u${i}`} href={part} target="_blank" rel="noopener noreferrer">
        {shortUrl(part)}
      </a>
    ) : (
      <span key={`t${i}`}>{part}</span>
    ),
  );
}

function boldParts(text: string, keyBase: string) {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={`${keyBase}-${i}`}>{part}</strong> : <span key={`${keyBase}-${i}`}>{part}</span>,
  );
}

/** UM ÍNDICE E UM NÚMERO POR SECÇÃO (v76.57). O relatório cresceu para nove
 *  secções e passou a ler-se como um rolo: quem o abre não sabe quanto falta
 *  nem o que lá vem. Numerar dá-lhe forma, e o índice do topo transforma-o
 *  num documento que se consulta em vez de se percorrer. Em papel, os
 *  números são a única forma de alguém dizer «vê o ponto 6». */
function SecLabel({
  n,
  id,
  children,
  onTint,
}: {
  n: number;
  /** Âncora do índice de navegação do cliente (`wa-sec-<chave>`). */
  id?: string;
  children: React.ReactNode;
  onTint?: boolean;
}) {
  return (
    <div id={id} className={`wa-label${onTint ? " wa-label-on-tint" : ""}`}>
      <span className="wa-secn">{String(n).padStart(2, "0")}</span>
      {children}
    </div>
  );
}

/** Linha de 12 meses dentro do cartão do KPI. Sem eixos, sem rótulos: a
 *  forma é a informação, e o número grande por cima já dá a escala. */
function Spark({ values }: { values: (number | null)[] }) {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 3) return null;
  const max = Math.max(...pts, 1);
  const w = 100;
  const h = 22;
  const step = w / Math.max(1, values.length - 1);
  let d = "";
  let started = false;
  values.forEach((v, i) => {
    if (v === null) {
      started = false;
      return;
    }
    const x = i * step;
    const y = h - (v / max) * (h - 2) - 1;
    d += `${started ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    started = true;
  });
  const last = values[values.length - 1];
  return (
    <svg className="wa-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <path d={d.trim()} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {last !== null && last !== undefined && (
        <circle cx={w} cy={h - (last / max) * (h - 2) - 1} r="1.8" />
      )}
    </svg>
  );
}

/** Pastilha de posição, por escalão. Um 3 e um 47 são histórias diferentes e
 *  numa coluna de números cinzentos leem-se igual. */
function PosPill({ pos, decimals }: { pos: number | null; decimals: boolean }) {
  if (pos === null) return null;
  const band = pos <= 3 ? "p1" : pos <= 10 ? "p2" : pos <= 20 ? "p3" : "p4";
  return (
    <span className={`wa-pos ${band}`}>{decimals ? pos.toFixed(1) : pos}</span>
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

/** Month-over-month move in WHOLE places, for the SE Ranking table. Positions
 *  there are exact SERP ranks, not averages, so "▲ 3" reads better than
 *  "▲ 3.0". null = no earlier check to compare against (not a new keyword). */
function PlaceCell({ change }: { change: number | null }) {
  if (change === null) return <span className="wa-flat-t">—</span>;
  if (change > 0) return <span className="wa-up">▲ {change}</span>;
  if (change < 0) return <span className="wa-down-t">▼ {Math.abs(change)}</span>;
  return <span className="wa-flat-t">—</span>;
}

/* —— Keyword tracking (v77.82) ——————————————————————————————————————— */

const KWT_SOURCE: Record<KwRankSource, { pt: string; en: string }> = {
  semrush: { pt: "Semrush", en: "Semrush" },
  gsc: { pt: "Search Console", en: "Search Console" },
  google: { pt: "Pesquisa Google", en: "Google search" },
};

/** «7», «6,8» (GSC), «100+» (não aparece) ou «—» (por preencher). */
function rankText(v: KwRankValue, lang: "pt" | "en"): string {
  if (v === null) return "—";
  if (v === "out") return "100+";
  return Number.isInteger(v)
    ? String(v)
    : v.toLocaleString(lang === "pt" ? "pt-PT" : "en-GB", {
        maximumFractionDigits: 1,
      });
}

function rankBand(v: KwRankValue): string {
  if (typeof v !== "number") return "p5";
  return v <= 3 ? "p1" : v <= 10 ? "p2" : v <= 20 ? "p3" : "p4";
}

/** A régua de 1 a 100 — em escala logarítmica, porque subir de 3 para 1 vale
 *  mais do que de 60 para 40, e é assim que a Google se lê. A primeira
 *  página fica marcada. */
function RankTrack({ pos }: { pos: KwRankValue }) {
  const x =
    typeof pos === "number"
      ? Math.max(0, Math.min(1, Math.log(pos) / Math.log(100)))
      : 1;
  return (
    <span className="wa-track" aria-hidden>
      <span className="wa-track-p1" />
      {pos !== null && (
        <span
          className={`wa-track-dot ${rankBand(pos)}`}
          style={{ left: `${(x * 100).toFixed(1)}%` }}
        />
      )}
    </span>
  );
}

/** Δ mês de uma keyword acompanhada. */
function MoveChip({
  change,
  lang,
}: {
  change: number | "in" | "lost" | null;
  lang: "pt" | "en";
}) {
  const pt = lang === "pt";
  if (change === "in")
    return <span className="wa-move up">{pt ? "▲ entrou" : "▲ new"}</span>;
  if (change === "lost")
    return <span className="wa-move down">{pt ? "▼ saiu" : "▼ lost"}</span>;
  if (change === null || change === 0)
    return <span className="wa-move flat">{change === 0 ? "=" : "—"}</span>;
  const n = Math.abs(change).toLocaleString(pt ? "pt-PT" : "en-GB", {
    maximumFractionDigits: 1,
  });
  return change > 0 ? (
    <span className="wa-move up">▲ {n}</span>
  ) : (
    <span className="wa-move down">▼ {n}</span>
  );
}

/** A headline KPI tile for the hero band. Hidden in client variant when the
 *  value is pending (nothing validated to show yet). */
function KpiTile({
  label,
  m,
  lang,
  variant,
  spark,
  deltas,
}: {
  label: string;
  m: ReportMetric;
  lang: "pt" | "en";
  variant: Variant;
  /** 12 meses da mesma métrica, quando o snapshot os tem. */
  spark?: (number | null)[];
  /** false num relatório parcial — ver `showDeltas` em ReportDocument. */
  deltas?: boolean;
}) {
  const isNa = Boolean(m.manualNa);
  const pending = m.value === null && !isNa;
  if (pending && variant === "client") return null;
  // ZERO NÃO É NÚMERO PARA MOSTRAR A UM CLIENTE (v76.60). Um cartão a dizer
  // «0» ou «0%» não informa nada que a ausência do cartão não informe, e num
  // relatório mensal lê-se como uma acusação. O consultor continua a ver
  // tudo na vista interna, que é onde o zero é acionável.
  if (variant === "client" && m.value === 0) return null;
  return (
    <div className="wa-kpi">
      <div className="wa-kpi-l">{label}</div>
      <div className="wa-kpi-v">
        {pending ? <span className="wa-kpi-dash">—</span> : isNa ? "N/A" : formatValue(m, lang)}
      </div>
      {!pending && !isNa && deltas !== false && <DeltaChip delta={metricDelta(m, lang)} />}
      {pending && <div className="wa-kpi-note">{pendingNote(m, lang)}</div>}
      {!pending && spark && <Spark values={spark} />}
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
  deltas,
}: {
  label: string;
  m: ReportMetric;
  lang: "pt" | "en";
  variant: Variant;
  /** false num relatório parcial — ver `showDeltas` em ReportDocument. */
  deltas?: boolean;
}) {
  const isNa = Boolean(m.manualNa);
  const pending = m.value === null && !isNa;
  if (pending && variant === "client") return null;
  if (variant === "client" && m.value === 0) return null;
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
            {deltas !== false && <DeltaChip delta={metricDelta(m, lang)} />}
          </>
        )}
      </span>
    </div>
  );
}

/** Rótulos das linhas da tabela de conversão e-commerce, na ordem fixa. */
const ECOM_ROW_LABELS: Record<EcomMetricKey, { pt: string; en: string }> = {
  revenue: { pt: "Receita", en: "Revenue" },
  transactions: { pt: "Transações", en: "Transactions" },
  conversionRate: { pt: "Conversão", en: "Conversion rate" },
  users: { pt: "Utilizadores", en: "Users" },
  impressions: { pt: "Impressões", en: "Impressions" },
  avgTicket: { pt: "Ticket médio", en: "Avg. order value" },
};

/** Uma célula da tabela de conversão, formatada pela métrica. */
function ecomCellText(
  cell: EcomCell,
  key: EcomMetricKey,
  currency: string,
  lang: "pt" | "en",
): string {
  if (cell.manualNa) return "N/A";
  if (cell.value === null) return "—";
  const loc = lang === "pt" ? "pt-PT" : "en-GB";
  if (key === "revenue" || key === "avgTicket") {
    return formatMoney(cell.value, currency, lang);
  }
  if (key === "conversionRate") {
    return `${cell.value.toLocaleString(loc, { maximumFractionDigits: 2 })}%`;
  }
  return Math.round(cell.value).toLocaleString(loc);
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

  // Secções que o consultor retirou deste relatório (v77.2). Escondem-se em
  // TODAS as vistas — interna, PDF e link público — para o que se vê ser
  // sempre o que o cliente recebe.
  const hidden = new Set(snapshot.hiddenSections ?? []);

  const leadTotal = snapshot.leads.total;
  // DOIS TOTAIS EM VEZ DE UM (v77.9). O site e a Ficha Google medem coisas
  // diferentes — um formulário preenchido e um clique em «Ligar» no Maps —
  // e somá-los fazia do Kings Gyms «1.069 leads» com quase tudo a ser ficha.
  // Derivados dos canais nos relatórios gravados antes de existirem.
  const leadWebsite =
    snapshot.leads.website ?? websiteLeadTotal(snapshot.leads.channels);
  const leadGbp = snapshot.leads.gbp ?? gbpLeadTotal(snapshot.leads.channels);
  const hasGbpChannels = snapshot.leads.channels.some((c) =>
    isGbpChannelKey(c.key),
  );
  const visibleChannels = snapshot.leads.channels.filter(
    (c) =>
      variant === "internal" ||
      (c.metric.value !== null && c.metric.value > 0) ||
      c.metric.manualNa,
  );
  const maxChannel = Math.max(
    1,
    ...visibleChannels.map((c) => c.metric.value ?? 0),
  );

  const org = snapshot.organic;
  const gsc = snapshot.gsc;
  // Optional on the snapshot — reports generated before v76.15 have none.
  const coverage = snapshot.coverage;
  // RELATÓRIO PARCIAL = SÓ NÚMEROS, SEM VARIAÇÕES (v76.90). A meio do mês as
  // pastilhas «▼ -40,2%» dominam a página e o cliente lê-as como uma queda,
  // mesmo com as janelas cortadas ao mesmo nº de dias — um mês incompleto
  // não se compara com um mês inteiro. Os valores `previous` continuam no
  // snapshot; só a apresentação os esconde, e voltam quando o mês fecha e o
  // relatório é regenerado.
  const showDeltas = !coverage?.partial;
  // O Resumo Executivo é gerado (e gravado) no momento em que o relatório se
  // gera; os parciais gravados antes da v76.90 ainda trazem frases com «+365%
  // face ao mês anterior». Até serem regenerados, um parcial não mostra
  // nenhuma frase com percentagem — a única fonte de «%» nestas frases são
  // as comparações mensais (ver buildExecSummary).
  const execSummary = showDeltas
    ? snapshot.execSummary
    : snapshot.execSummary.filter((b) => !b.includes("%"));
  const leadDelta = showDeltas ? metricDelta(leadTotal, lang) : null;
  // GEO: o bloco novo (v76.57) manda quando existe. O antigo só continua
  // desenhado nos relatórios que já estavam gravados com ele — regenerar um
  // relatório antigo passa-o para a secção nova.
  const geoIntel = snapshot.geoIntel;
  const geo = geoIntel ? undefined : snapshot.geo;

  // —— A TABELA DE KEYWORDS É DO SERPSTAT E DE MAIS NINGUÉM (v76.58) ————
  //
  // E é a lista COMPLETA: todas as keywords para que o domínio (com
  // subdomínios) rankeia no top-100 da base regional — a mesma consulta que
  // se faz à mão no Serpstat. Antes mostrava-se só o plano de keywords, o
  // que fazia o relatório dizer «rankeamos para 9 coisas» quando a resposta
  // do Serpstat trazia 139. As do plano continuam distinguidas por uma
  // etiqueta, porque foi isso que se prometeu trabalhar.
  //
  // O DataForSEO e o GSC estão FORA desta secção por decisão do Andre
  // (v76.58): metodologias diferentes — uma média de impressões do GSC e um
  // lugar exato na SERP não são o mesmo número — e misturá-las num sítio
  // onde o cliente lê tudo como uma só medição produz um relatório errado.
  // Sem Serpstat não há tabela; o bloco `seRanking` dos relatórios ≤ v76.34
  // continua a desenhar-se para não apagar o que já estava gravado.
  const live =
    snapshot.liveRanks?.source === "serpstat" ? snapshot.liveRanks : undefined;
  const seRanking = live ? undefined : snapshot.seRanking;
  type KwRow = {
    keyword: string;
    position: number | null;
    change: number | null;
    volume: number | null;
    inPlan: boolean;
    aiOverview: boolean;
    citedInAio: boolean;
    difficulty: number | null;
    traffic: number | null;
    /** Acrescentada à mão pelo consultor (v77.9). */
    manual?: boolean;
  };
  const AIO = "ai_overview";
  const AIO_CITED = ["snip_url_in_aio", "snip_fqdn_in_aio"];
  const rowFrom = (
    r: {
      keyword: string;
      position: number | null;
      change: number | null;
      volume?: number | null;
      types?: string[];
      difficulty?: number | null;
      traffic?: number | null;
    },
    inPlan: boolean,
  ): KwRow => ({
    keyword: r.keyword,
    position: r.position,
    change: r.change,
    volume: r.volume ?? null,
    inPlan,
    aiOverview: (r.types ?? []).includes(AIO),
    citedInAio: (r.types ?? []).some((x) => AIO_CITED.includes(x)),
    difficulty: r.difficulty ?? null,
    traffic: r.traffic ?? null,
  });

  const kwRaw: KwRow[] = live
    ? [
        ...live.ranks.map((r) => rowFrom(r, true)),
        ...(live.others ?? []).map((r) => rowFrom(r, false)),
      ]
    : (seRanking?.ranks ?? []).map((r) =>
        rowFrom({ ...r, volume: r.volume }, true),
      );
  // A MÃO DO CONSULTOR (v77.9). O que ele escondeu não sai em NENHUMA vista
  // — interna, PDF, link público — e o que acrescentou à mão entra com a
  // posição que verificou. A regra «esconder as fora do top 100» aplica-se
  // por cima da lista escondida.
  const curation = snapshot.kwCuration;
  const kwHiddenSet = new Set(
    (curation?.hidden ?? []).map((k) => k.toLowerCase()),
  );
  const kwRawKeys = new Set(kwRaw.map((r) => r.keyword.toLowerCase()));
  const kwAll: KwRow[] = [
    ...kwRaw.filter(
      (r) =>
        !kwHiddenSet.has(r.keyword.toLowerCase()) &&
        !(curation?.hideUnranked && r.position === null),
    ),
    ...(curation?.added ?? [])
      .filter(
        (a) =>
          !kwHiddenSet.has(a.keyword.toLowerCase()) &&
          !kwRawKeys.has(a.keyword.toLowerCase()),
      )
      .map((a) => ({
        ...rowFrom({ keyword: a.keyword, position: a.position, change: null }, true),
        manual: true,
      })),
  ];

  // O MODO DA TABELA DO SERPSTAT (v77.82). O consultor decide: todas (o que
  // a app recomenda — quanta mais informação o cliente tiver, melhor), só
  // algumas que ele escolheu, ou nenhuma. A escolha mexe só nesta tabela: a
  // das AI Overviews (GEO) continua a ler a lista inteira.
  const serpMode = curation?.mode ?? "all";
  const pickedSet = new Set((curation?.picked ?? []).map((k) => k.toLowerCase()));
  const kwShown =
    serpMode === "some"
      ? kwAll.filter((r) => pickedSet.has(r.keyword.toLowerCase()))
      : kwAll;

  // A rankear primeiro, por lugar; as do plano que ainda não entraram no
  // top-100 ficam no fim — continuam a ser trabalho em curso e não uma
  // falha, mas não podem roubar o topo da tabela a quem já lá está.
  const byPos = (a: KwRow, b: KwRow) => (a.position ?? 0) - (b.position ?? 0);
  const kwRanked = kwShown.filter((r) => r.position !== null).sort(byPos);
  const kwPending = kwShown.filter((r) => r.position === null);
  // O cliente vê o que rankeia (princípio v76.32); o consultor vê a lista
  // toda, porque a lacuna é que é acionável. SEM TETO desde a v77.82 (era
  // 70): a lista inteira vai, mas só as primeiras KW_FOLD se veem de início —
  // o resto abre com «Ver todas», e no PDF sai tudo.
  const KW_FOLD = 20;
  const kwVisible =
    variant === "internal" ? [...kwRanked, ...kwPending] : kwRanked;
  const kwDecimals = false;
  // AI OVERVIEW, do Serpstat, na mesma resposta que deu a tabela acima. É a
  // prova mais concreta de GEO que existe: a Google mostra resposta gerada
  // nesta pesquisa, e ou cita este site ou cita outro. Lê a lista inteira
  // (só sem o que o consultor escondeu), seja qual for o modo da tabela.
  const aioRows = kwAll
    .filter((r) => r.position !== null && (r.aiOverview || r.citedInAio))
    .sort(
      (a, b) =>
        Number(b.citedInAio) - Number(a.citedInAio) ||
        (b.volume ?? 0) - (a.volume ?? 0) ||
        (a.position ?? 999) - (b.position ?? 999),
    );
  const kwTop10 = kwRanked.filter((r) => (r.position ?? 999) <= 10).length;

  // —— KEYWORD TRACKING (v77.82) ——————————————————————————————————————
  // As 15 que o consultor escolheu e verificou à mão. Cada linha mostra a
  // fonte que ele escolheu e diz qual é — Semrush, Search Console e uma
  // pesquisa Google não são a mesma medição (v76.58).
  const kwt = snapshot.kwTracking;
  const kwtRows = (kwt?.keywords ?? [])
    .map((k) => ({ k, pos: shownRank(k), change: kwRankChange(k) }))
    .filter((r) => variant === "internal" || r.pos !== null)
    .sort((a, b) => {
      const va = typeof a.pos === "number" ? a.pos : a.pos === "out" ? 1000 : 2000;
      const vb = typeof b.pos === "number" ? b.pos : b.pos === "out" ? 1000 : 2000;
      return va - vb || (b.k.volume ?? 0) - (a.k.volume ?? 0);
    });
  const kwtNums = kwtRows
    .map((r) => r.pos)
    .filter((v): v is number => typeof v === "number");
  const kwtTop3 = kwtNums.filter((v) => v <= 3).length;
  const kwtTop10 = kwtNums.filter((v) => v <= 10).length;
  const kwtUp = kwtRows.filter(
    (r) => r.change === "in" || (typeof r.change === "number" && r.change > 0),
  ).length;
  const kwtAvg = kwtNums.length
    ? kwtNums.reduce((a, b) => a + b, 0) / kwtNums.length
    : null;
  const kwtSources = Array.from(new Set(kwtRows.map((r) => r.k.show)));

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

  // —— Bloco e-commerce (v77.0) ——————————————————————————————————————
  // A tabela de conversão orgânica + páginas mais acedidas + produtos mais
  // vendidos. O cliente vê só o que está validado: colunas onde nada foi
  // preenchido caem, células por preencher desenham «—», listas vazias somem.
  const ecom = snapshot.ecom;
  const ecomColumns = (ecom?.columns ?? []).filter(
    (col) =>
      variant === "internal" ||
      ECOM_METRIC_KEYS.some(
        (k) => col.cells[k].value !== null || col.cells[k].manualNa,
      ),
  );
  const ecomRowKeys = ECOM_METRIC_KEYS.filter(
    (k) =>
      variant === "internal" ||
      ecomColumns.some((col) => col.cells[k].value !== null),
  );
  const showEcomTable =
    Boolean(ecom) &&
    !hidden.has("ecom") &&
    (variant === "internal" ||
      (ecomColumns.length > 0 && ecomRowKeys.length > 0));
  const ecomPages = ecom?.topPages ?? [];
  const showEcomPages =
    Boolean(ecom) &&
    !hidden.has("ecomPages") &&
    (variant === "internal" || ecomPages.length > 0);
  const ecomProducts = ecom?.topProducts ?? [];
  const showEcomProducts =
    Boolean(ecom) &&
    !hidden.has("ecomProducts") &&
    (variant === "internal" || ecomProducts.length > 0);
  // Nota de metodologia: dinheiro vindo da Shopify é da loja INTEIRA.
  const ecomMoneyFromShopify = (ecom?.columns ?? []).some((col) =>
    (["revenue", "transactions", "avgTicket"] as EcomMetricKey[]).some(
      (k) => col.cells[k].source === "shopify" && col.cells[k].value !== null,
    ),
  );
  const ecomMaxPageViews = Math.max(1, ...ecomPages.map((p) => p.views));
  const ecomMaxProductRevenue = Math.max(
    1,
    ...ecomProducts.map((p) => p.revenue),
  );
  const ecomMonthName =
    ecom?.columns.find((c) => !c.yoy && c.key === snapshot.period)?.label ?? "";

  // Hero KPIs — the month's headline numbers. Order = what the client cares
  // about most: leads first, then reach, then search performance.
  const kpiDefs: { label: string; m: ReportMetric }[] = [
    { label: t("Leads do website", "Website leads"), m: leadWebsite },
    ...(hasGbpChannels
      ? [{ label: t("Contactos Ficha Google", "Google listing contacts"), m: leadGbp }]
      : []),
    { label: t("Utilizadores orgânicos", "Organic users"), m: org.users },
    { label: t("Clicks no Google", "Google clicks"), m: gsc.clicks },
    { label: t("Posição média", "Avg. position"), m: gsc.position },
  ];
  const kpis = kpiDefs.filter(
    (k) =>
      variant === "internal" ||
      (k.m.value !== null && k.m.value !== 0) ||
      k.m.manualNa,
  );

  const showAi =
    !hidden.has("ai") && (ai.sources.length > 0 || variant === "internal");
  const showNotes =
    !hidden.has("notes") &&
    (Boolean(snapshot.notes.trim()) || variant === "internal");
  const showLeads =
    !hidden.has("leads") &&
    (variant === "internal" ||
      (leadTotal.value !== null && leadTotal.value > 0) ||
      visibleChannels.length > 0);
  const showGeo =
    !hidden.has("geo") &&
    Boolean(snapshot.geoIntel || geo || aioRows.length > 0);
  const showExec = execSummary.length > 0 && !hidden.has("exec");
  const showTrend = Boolean(snapshot.trend) && !hidden.has("trend");
  const showTraffic = !hidden.has("traffic");
  const showKw =
    !hidden.has("kw") &&
    serpMode !== "off" &&
    (kwVisible.length > 0 || variant === "internal");
  const showKwt = !hidden.has("kwt") && kwtRows.length > 0;

  // Google IA — impressões nas AI Overviews / AI Mode (GSC · Generative AI).
  // O cliente só vê a secção com um número validado; a interna mostra-a
  // sempre que o bloco existe, para o consultor saber o que falta.
  const gscAiB = snapshot.gscAi;
  const gscAiPending =
    Boolean(gscAiB) &&
    gscAiB!.impressions.value === null &&
    !gscAiB!.impressions.manualNa;
  const showGscAi =
    Boolean(gscAiB) &&
    !hidden.has("gscAi") &&
    (variant === "internal" ||
      (gscAiB!.impressions.value !== null && gscAiB!.impressions.value > 0) ||
      gscAiB!.topPages.length > 0);
  const gscAiMaxPage = Math.max(
    1,
    ...(gscAiB?.topPages ?? []).map((p) => p.impressions),
  );
  const gscAiDevTotal = (gscAiB?.byDevice ?? []).reduce(
    (t, d) => t + d.impressions,
    0,
  );
  const gscAiSpark =
    gscAiB && gscAiB.impressions.value !== null
      ? [...(gscAiB.impressions.history ?? []), gscAiB.impressions.value]
      : (gscAiB?.impressions.history ?? []);

  // O ÍNDICE. Uma lista só, montada com as mesmas condições que desenham as
  // secções, para que o número no cabeçalho e a entrada no índice não possam
  // divergir — que é o que aconteceria se cada secção soubesse o seu número.
  const secs: { key: string; label: string }[] = [
    ...(showExec
      ? [{ key: "exec", label: t("Resumo Executivo", "Executive Summary") }]
      : []),
    ...(showTrend ? [{ key: "trend", label: t("Evolução", "Trend") }] : []),
    ...(showEcomTable
      ? [{ key: "ecom", label: t("Conversão · SEO Orgânico", "Conversion · Organic SEO") }]
      : []),
    ...(showEcomPages
      ? [{ key: "ecomPages", label: t("Páginas mais acedidas", "Most visited pages") }]
      : []),
    ...(showEcomProducts
      ? [{ key: "ecomProducts", label: t("Produtos mais vendidos", "Best-selling products") }]
      : []),
    ...(showLeads
      ? [{ key: "leads", label: t("Leads por canal", "Leads by channel") }]
      : []),
    ...(showTraffic
      ? [{ key: "traffic", label: t("Tráfego & Ficha Google", "Traffic & Google listing") }]
      : []),
    ...(showAi ? [{ key: "ai", label: "AI Visibility" }] : []),
    ...(showGscAi
      ? [{ key: "gscAi", label: t("Google IA · AI Overviews", "Google AI · AI Overviews") }]
      : []),
    ...(showKwt
      ? [{ key: "kwt", label: t("Keywords acompanhadas", "Tracked keywords") }]
      : []),
    ...(showKw
      ? [{ key: "kw", label: t("Onde o site aparece", "Where the site shows up") }]
      : []),
    ...(showGeo ? [{ key: "geo", label: t("GEO · SEO para IA", "GEO · SEO for AI") }] : []),
    ...(showNotes
      ? [{ key: "notes", label: t("Notas & próximos passos", "Notes & next steps") }]
      : []),
  ];
  const secN = (key: string) => secs.findIndex((x) => x.key === key) + 1;

  // Séries do gráfico de evolução reaproveitadas como sparkline dos KPI.
  const tr = snapshot.trend;
  const sparkFor: Record<string, (number | null)[] | undefined> = {
    [t("Leads do website", "Website leads")]: tr?.leads,
    [t("Utilizadores orgânicos", "Organic users")]: tr?.organicUsers,
    [t("Clicks no Google", "Google clicks")]: tr?.gscClicks,
  };

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
        {/* O CLIENTE É O TÍTULO (v77.82). O relatório é dele — o tipo de
            relatório passa a sobretítulo. */}
        <div className="wa-ckicker">
          {t("Relatório mensal de SEO & Leads", "Monthly SEO & Leads report")}
        </div>
        <h1 className="wa-ctitle">{snapshot.clientTitle}</h1>
        <div className="wa-cconsult">
          <span className="wa-cavatar" aria-hidden>
            {(snapshot.consultant.name || "W").trim().charAt(0).toUpperCase()}
          </span>
          <span>
            {t("O teu consultor", "Your consultant")}:{" "}
            <b>{snapshot.consultant.name}</b>
            {snapshot.consultant.email ? ` · ${snapshot.consultant.email}` : ""}
          </span>
        </div>
        {coverage?.partial && (
          <div className="wa-cpartial">
            {t(
              `Relatório parcial — cobre os dias 1 a ${coverage.days} de ${coverage.monthDays}. Sem comparações com o mês anterior: um mês incompleto não se compara com um mês inteiro.`,
              `Partial report — covers days 1–${coverage.days} of ${coverage.monthDays}. No prior-month comparisons: an incomplete month can't be compared to a full one.`,
            )}
          </div>
        )}
      </header>

      {/* Hero KPI band */}
      {kpis.length > 0 && (
        <section className={`wa-kpis n${Math.min(kpis.length, 6)}`}>
          {kpis.map((k) => (
            <KpiTile
              key={k.label}
              label={k.label}
              m={k.m}
              lang={lang}
              variant={variant}
              spark={sparkFor[k.label]}
              deltas={showDeltas}
            />
          ))}
        </section>
      )}

      {/* ÍNDICE (v77.82) — só no link do cliente e só no ecrã: uma fila de
          atalhos que fica presa ao topo enquanto se lê. */}
      {variant === "client" && secs.length > 2 && (
        <nav className="wa-nav" aria-label={t("Secções do relatório", "Report sections")}>
          {secs.map((x) => (
            <a key={x.key} href={`#wa-sec-${x.key}`}>
              {x.label}
            </a>
          ))}
        </nav>
      )}

      {/* Executive Summary — the wins, up front */}
      {showExec && (
        <section className="wa-sec">
          <div className="wa-exec-card">
            <SecLabel n={secN("exec")} id="wa-sec-exec" onTint>
              {t("Resumo Executivo", "Executive Summary")}
            </SecLabel>
            <h2 className="wa-h2 wa-exec-h">
              {t("O mês em destaque", "The month at a glance")}
            </h2>
            <ul className="wa-exec">
              {execSummary.map((b, i) => (
                <li key={i}>
                  <span className="wa-exec-ic" aria-hidden>
                    ✓
                  </span>
                  <span>{boldParts(b, `ex${i}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Evolução — vem logo a seguir ao sumário porque é a resposta à
          primeira pergunta que o cliente faz («isto está a crescer?»), e
          nenhum número de um mês sozinho a responde. */}
      {showTrend && snapshot.trend && (
        <section className="wa-sec wa-sec-trend">
          <SecLabel n={secN("trend")} id="wa-sec-trend">{t("Evolução", "Trend")}</SecLabel>
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

      {/* Conversão e-commerce — os 3 últimos meses lado a lado + o mês
          homólogo (coluna cinza), porque numa loja online o MoM sozinho
          esconde a sazonalidade (Black Friday & afins). */}
      {ecom && showEcomTable && (
        <section className="wa-sec">
          <SecLabel n={secN("ecom")} id="wa-sec-ecom">
            {t("Conversão · SEO Orgânico", "Conversion · Organic SEO")}
          </SecLabel>
          <h2 className="wa-h2">
            {t("O que a pesquisa orgânica vendeu", "What organic search sold")}
          </h2>
          <div className="wa-tblwrap">
            <table className="wa-qtable wa-ectable">
              <thead>
                <tr>
                  <th>{t("Descrição", "Description")}</th>
                  {ecomColumns.map((col) => (
                    <th key={col.key} className={`n${col.yoy ? " wa-ec-yoy" : ""}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ecomRowKeys.map((rowKey) => (
                  <tr
                    key={rowKey}
                    className={rowKey === "revenue" ? "wa-ec-rev" : undefined}
                  >
                    <td className="wa-ec-desc">
                      {ECOM_ROW_LABELS[rowKey][lang]}
                    </td>
                    {ecomColumns.map((col) => {
                      const cell = col.cells[rowKey];
                      const pending = cell.value === null && !cell.manualNa;
                      return (
                        <td
                          key={col.key}
                          className={`n${col.yoy ? " wa-ec-yoy" : ""}`}
                          title={
                            variant === "internal" && pending
                              ? t("por preencher", "awaiting input")
                              : undefined
                          }
                        >
                          {pending ? (
                            <span className="wa-pending">—</span>
                          ) : (
                            ecomCellText(cell, rowKey, ecom.currency, lang)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="wa-method" style={{ marginTop: ".6rem" }}>
            {ecomMoneyFromShopify
              ? t(
                  "Receita, transações e ticket médio vêm da Shopify — totais da loja inteira (todos os canais), porque o GA4 deste cliente não tem purchase tracking. Utilizadores segmentados ao canal orgânico no GA4; impressões do Search Console.",
                  "Revenue, transactions and average order value come from Shopify — whole-store totals (all channels), as this client's GA4 has no purchase tracking. Users segmented to the organic channel in GA4; impressions from Search Console.",
                )
              : t(
                  "Receita, transações, conversão e utilizadores segmentados ao canal Organic Search no Google Analytics 4; impressões do Search Console. Ticket médio = receita ÷ transações.",
                  "Revenue, transactions, conversion and users segmented to the Organic Search channel in Google Analytics 4; impressions from Search Console. Avg. order value = revenue ÷ transactions.",
                )}
          </p>
        </section>
      )}

      {/* Páginas orgânicas mais acedidas no mês do relatório. */}
      {ecom && showEcomPages && (
        <section className="wa-sec">
          <SecLabel n={secN("ecomPages")} id="wa-sec-ecomPages">
            {t("Páginas mais acedidas · SEO", "Most visited pages · SEO")}
          </SecLabel>
          <h3 className="wa-h3">
            {t(
              `Top ${ecomPages.length || 10} em ${ecomMonthName}`,
              `Top ${ecomPages.length || 10} in ${ecomMonthName}`,
            )}
          </h3>
          {ecomPages.length === 0 ? (
            <p className="wa-pending-lg">
              {t(
                "Sem dados do GA4 — preenche a lista manualmente abaixo, ou a secção não sai no relatório do cliente.",
                "No GA4 data — fill the list manually below, or the section is omitted from the client report.",
              )}
            </p>
          ) : (
            <div className="wa-toplist">
              {ecomPages.map((p, i) => (
                <div className="wa-top-row" key={`${p.page}-${i}`}>
                  <span className="wa-top-n">{i + 1}</span>
                  <span className="wa-top-name">{p.page}</span>
                  <span className="wa-top-bar">
                    <i
                      style={{
                        width: `${(p.views / ecomMaxPageViews) * 100}%`,
                        background: GRAD,
                      }}
                    />
                  </span>
                  <span className="wa-top-v">
                    {formatRaw(p.views, "count", lang)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {ecomPages.length > 0 && (
            <p className="wa-method" style={{ marginTop: ".6rem" }}>
              {ecom.topPagesSource === "manual"
                ? t("Preenchido pelo consultor.", "Filled in by the consultant.")
                : t(
                    "Visualizações de página de sessões do canal Organic Search (GA4).",
                    "Page views from Organic Search channel sessions (GA4).",
                  )}
            </p>
          )}
        </section>
      )}

      {/* Produtos mais vendidos no mês do relatório, por receita. */}
      {ecom && showEcomProducts && (
        <section className="wa-sec">
          <SecLabel n={secN("ecomProducts")} id="wa-sec-ecomProducts">
            {t("Produtos mais vendidos · SEO", "Best-selling products · SEO")}
          </SecLabel>
          <h3 className="wa-h3">
            {t(
              `Top ${ecomProducts.length || 10} em ${ecomMonthName}`,
              `Top ${ecomProducts.length || 10} in ${ecomMonthName}`,
            )}
          </h3>
          {ecomProducts.length === 0 ? (
            <p className="wa-pending-lg">
              {t(
                "Sem dados de produtos — nem do GA4 (items) nem da Shopify. Preenche a lista manualmente abaixo, ou a secção não sai no relatório do cliente.",
                "No product data — neither GA4 (items) nor Shopify. Fill the list manually below, or the section is omitted from the client report.",
              )}
            </p>
          ) : (
            <div className="wa-toplist">
              {ecomProducts.map((p, i) => (
                <div className="wa-top-row" key={`${p.name}-${i}`}>
                  <span className="wa-top-n">{i + 1}</span>
                  <span className="wa-top-name">
                    {p.name}
                    {p.quantity !== null && p.quantity > 0 && (
                      <span className="wa-top-qty">
                        {p.quantity} {t("un.", "un.")}
                      </span>
                    )}
                  </span>
                  <span className="wa-top-bar">
                    <i
                      style={{
                        width: `${(p.revenue / ecomMaxProductRevenue) * 100}%`,
                        background: GRAD,
                      }}
                    />
                  </span>
                  <span className="wa-top-v">
                    {formatMoney(p.revenue, ecom.currency, lang)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {ecomProducts.length > 0 && (
            <p className="wa-method" style={{ marginTop: ".6rem" }}>
              {ecom.topProductsSource === "shopify"
                ? t(
                    "Vendas da Shopify — loja inteira (todos os canais), porque o GA4 não tem tracking de items.",
                    "Shopify sales — whole store (all channels), as GA4 has no item tracking.",
                  )
                : ecom.topProductsSource === "manual"
                  ? t("Preenchido pelo consultor.", "Filled in by the consultant.")
                  : ecom.topProductsWholeStore
                    ? t(
                        "Receita de items no GA4 — loja inteira (todos os canais): o GA4 não permite cruzar produtos com o canal da sessão.",
                        "Item revenue in GA4 — whole store (all channels): GA4 cannot cross products with the session channel.",
                      )
                    : t(
                        "Receita de items de sessões do canal Organic Search (GA4).",
                        "Item revenue from Organic Search channel sessions (GA4).",
                      )}
            </p>
          )}
        </section>
      )}

      {/* Leads breakdown — some some quando não há nada de positivo a dizer:
          um «0 leads no total» com uma grelha de barras vazias é a única
          coisa que o cliente lê da página inteira. */}
      {showLeads && (
      <section className="wa-sec">
        <SecLabel n={secN("leads")} id="wa-sec-leads">
          {t("Leads por canal", "Leads by channel")}
        </SecLabel>
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
        {leadTotal.value !== null && hasGbpChannels && (
          <p className="wa-lead-split">
            {leadWebsite.value !== null && (
              <span>
                <b>{formatValue(leadWebsite, lang)}</b>{" "}
                {t("no website", "on the website")}
              </span>
            )}
            {leadGbp.value !== null && (
              <span>
                <b>{formatValue(leadGbp, lang)}</b>{" "}
                {t("na Ficha Google", "via the Google listing")}
              </span>
            )}
          </p>
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
      )}

      {/* GBP + Organic side by side */}
      {showTraffic && (
      <section className="wa-sec">
        <SecLabel n={secN("traffic")} id="wa-sec-traffic">
          {t("Tráfego & Ficha Google", "Traffic & Google listing")}
        </SecLabel>
        <div className="wa-two wa-two-sp">
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
            <MetricRow label={t("Cliques p/ website", "Website clicks")} m={gbp.websiteClicks} lang={lang} variant={variant} deltas={showDeltas} />
            <MetricRow label={t("Pedidos de direções", "Direction requests")} m={gbp.directions} lang={lang} variant={variant} deltas={showDeltas} />
            <MetricRow label={t("Cliques p/ ligar", "Call clicks")} m={gbp.callClicks} lang={lang} variant={variant} deltas={showDeltas} />

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
                    <MetricRow label={t("Cliques p/ website", "Website clicks")} m={p.websiteClicks} lang={lang} variant={variant} deltas={showDeltas} />
                    <MetricRow label={t("Pedidos de direções", "Direction requests")} m={p.directions} lang={lang} variant={variant} deltas={showDeltas} />
                    <MetricRow label={t("Cliques p/ ligar", "Call clicks")} m={p.callClicks} lang={lang} variant={variant} deltas={showDeltas} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="wa-card">
            <div className="wa-label">{t("Tráfego Orgânico", "Organic Traffic")}</div>
            <h3 className="wa-h3">GA4 · GSC</h3>
            <MetricRow label={t("Sessões orgânicas", "Organic sessions")} m={org.sessions} lang={lang} variant={variant} deltas={showDeltas} />
            <MetricRow label={t("Utilizadores orgânicos", "Organic users")} m={org.users} lang={lang} variant={variant} deltas={showDeltas} />
            <MetricRow label={t("Utilizadores Google orgânico", "Google organic users")} m={org.googleOrganicUsers} lang={lang} variant={variant} deltas={showDeltas} />
            <MetricRow label={t("Tempo médio / utilizador", "Avg time / user")} m={org.avgEngagementTimePerUser} lang={lang} variant={variant} deltas={showDeltas} />
            <MetricRow label={t("Taxa de engagement", "Engagement rate")} m={org.engagementRate} lang={lang} variant={variant} deltas={showDeltas} />
            <MetricRow label={t("Clicks (GSC)", "Clicks (GSC)")} m={gsc.clicks} lang={lang} variant={variant} deltas={showDeltas} />
            <MetricRow label={t("Impressões (GSC)", "Impressions (GSC)")} m={gsc.impressions} lang={lang} variant={variant} deltas={showDeltas} />
            <MetricRow label={t("Posição média (GSC)", "Avg position (GSC)")} m={gsc.position} lang={lang} variant={variant} deltas={showDeltas} />
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
      )}

      {/* AI Visibility */}
      {showAi && (
        <section className="wa-sec">
          <SecLabel n={secN("ai")} id="wa-sec-ai">AI Visibility</SecLabel>
          <h3 className="wa-h3">{t("Visitantes vindos de assistentes de IA", "Visitors from AI assistants")}</h3>
          <p className="wa-method">
            {ai.channelSessions
              ? t(
                  "Visitas que chegaram ao site a partir de um assistente de IA. O número segue o canal «AI Assistant» do Google Analytics 4 — a classificação da própria Google — somado às origens que ela ainda não classifica (Perplexity, por exemplo, chega muitas vezes sem domínio identificado).",
                  "Visits that arrived from an AI assistant. The figure follows Google Analytics 4's own “AI Assistant” channel — Google's own classification — plus the sources it doesn't classify yet (Perplexity, for instance, often arrives without an identified domain).",
                )
              : t(
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
                {showDeltas && <DeltaChip delta={metricDelta(ai.totalSessions, lang)} />}
              </div>
              {ai.channelSessions?.value !== undefined &&
                ai.channelSessions?.value !== null && (
                  <p className="wa-ai-native">
                    {t(
                      `Destas, ${formatRaw(ai.channelSessions.value, "count", lang)} foram classificadas pela própria Google no canal «AI Assistant».`,
                      `Of these, ${formatRaw(ai.channelSessions.value, "count", lang)} were classified by Google itself in the “AI Assistant” channel.`,
                    )}
                  </p>
                )}
              <div className="wa-ai-grid">
                {[...ai.sources]
                  .sort((a, b) => b.sessions - a.sessions)
                  .map((s) => {
                    const prev = s.previousSessions;
                    const growth =
                      showDeltas && typeof prev === "number" && prev > 0
                        ? ((s.sessions - prev) / prev) * 100
                        : null;
                    return (
                      <div className="wa-ai-card" key={s.source}>
                        <div className="wa-ai-src">◆ {s.label}</div>
                        <div className="wa-ai-sess">{formatRaw(s.sessions, "count", lang)}</div>
                        {growth !== null && Math.abs(growth) >= 1 && (
                          <span
                            className={`wa-delta ${growth > 0 ? "up" : "down"}`}
                          >
                            {growth > 0 ? "▲" : "▼"} {Math.abs(growth).toFixed(0)}%
                          </span>
                        )}
                        {variant === "internal" && s.native === false && (
                          <div className="wa-ai-flag">
                            {t("fora do canal da Google", "outside Google's channel")}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </section>
      )}

      {/* Google IA — o relatório Generative AI do Search Console: quantas
          vezes as páginas apareceram DENTRO das AI Overviews e do AI Mode.
          É a métrica de GEO mais oficial que existe: é a própria Google a
          contar. Distinta do AI Visibility acima (visitantes vindos de
          assistentes) — aqui é presença nas respostas, medida na origem. */}
      {showGscAi && gscAiB && (
        <section className="wa-sec">
          <SecLabel n={secN("gscAi")} id="wa-sec-gscAi">
            {t("Google IA · AI Overviews", "Google AI · AI Overviews")}
          </SecLabel>
          <h3 className="wa-h3">
            {t(
              "Quantas vezes aparecemos nas respostas de IA da Google",
              "How often we appear in Google's AI answers",
            )}
          </h3>
          <p className="wa-method">
            {t(
              "Impressões do site dentro das AI Overviews e do AI Mode da Pesquisa Google — medidas pela própria Google (Search Console · relatório Generative AI). A Google reporta apenas impressões nestas superfícies; os cliques continuam contados no total de Pesquisa.",
              "Impressions of the site inside Google Search's AI Overviews and AI Mode — measured by Google itself (Search Console · Generative AI report). Google reports impressions only for these surfaces; clicks remain counted in the overall Search totals.",
            )}
          </p>

          {gscAiPending ? (
            <p className="wa-pending-lg">
              {t(
                "Por preencher — cola o export do Search Console no cartão «Google IA» (a Google ainda não dá API para este relatório).",
                "Awaiting input — paste the Search Console export in the “Google AI” card (Google offers no API for this report yet).",
              )}
            </p>
          ) : gscAiB.impressions.manualNa ? (
            variant === "internal" ? (
              <p className="wa-pending-lg">
                {t(
                  "Marcado N/A este mês — a propriedade ainda não tem visibilidade em IA suficiente para a Google mostrar o relatório.",
                  "Marked N/A this month — the property doesn't yet have enough AI visibility for Google to show the report.",
                )}
              </p>
            ) : null
          ) : (
            <>
              <div className="wa-gai-hero">
                <div className="wa-gai-num">
                  <span className="wa-gai-v">
                    {formatRaw(gscAiB.impressions.value ?? 0, "count", lang)}
                  </span>
                  <span className="wa-gai-l">
                    {t(
                      "impressões em respostas de IA este mês",
                      "impressions in AI answers this month",
                    )}
                  </span>
                  {showDeltas && (
                    <DeltaChip delta={metricDelta(gscAiB.impressions, lang)} />
                  )}
                </div>
                {gscAiSpark.length >= 3 && (
                  <div className="wa-gai-spark">
                    <Spark values={gscAiSpark} />
                    <span className="wa-gai-spark-l">
                      {t("últimos meses", "recent months")}
                    </span>
                  </div>
                )}
              </div>

              {gscAiB.byDevice.length > 0 && gscAiDevTotal > 0 && (
                <div className="wa-chan" style={{ marginTop: ".85rem" }}>
                  {gscAiB.byDevice.map((d) => (
                    <div className="wa-chan-row" key={d.device}>
                      <span className="wa-cn">{d.device}</span>
                      <span className="wa-cbar">
                        <i
                          style={{
                            width: `${(d.impressions / gscAiDevTotal) * 100}%`,
                            background: GRAD,
                          }}
                        />
                      </span>
                      <span className="wa-cv">
                        {formatRaw(d.impressions, "count", lang)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {gscAiB.topPages.length > 0 && (
                <>
                  <h3 className="wa-h3" style={{ marginTop: "1.1rem" }}>
                    {t(
                      "Páginas que a IA da Google mais mostra",
                      "Pages Google's AI shows the most",
                    )}
                  </h3>
                  <div className="wa-toplist">
                    {gscAiB.topPages.map((p, i) => (
                      <div className="wa-top-row" key={`${p.page}-${i}`}>
                        <span className="wa-top-n">{i + 1}</span>
                        <span className="wa-top-name">{p.page}</span>
                        <span className="wa-top-bar">
                          <i
                            style={{
                              width: `${(p.impressions / gscAiMaxPage) * 100}%`,
                              background: GRAD,
                            }}
                          />
                        </span>
                        <span className="wa-top-v">
                          {formatRaw(p.impressions, "count", lang)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* KEYWORD TRACKING (v77.82) — as 15 pesquisas que a equipa escolheu e
          verificou à mão este mês. Vem antes da lista do Serpstat porque é
          a resposta à pergunta que o cliente faz («e as keywords que
          estamos a trabalhar?»). */}
      {showKwt && kwt && (
        <section className="wa-sec wa-kwt">
          <SecLabel n={secN("kwt")} id="wa-sec-kwt">
            {t("Keywords acompanhadas", "Tracked keywords")}
          </SecLabel>
          <h2 className="wa-h2">
            {t(
              `As ${kwtRows.length} pesquisas que estamos a trabalhar`,
              `The ${kwtRows.length} searches we're working on`,
            )}
          </h2>
          <p className="wa-method">
            {t(
              "Escolhidas do plano de keywords do projeto e verificadas uma a uma pela equipa este mês. Ao lado de cada posição está a fonte da medição.",
              "Chosen from the project's keyword plan and checked one by one by the team this month. Each position shows where it was measured.",
            )}
          </p>
          <div className="wa-kwt-stats">
            <div className="wa-kwt-stat hero">
              <span className="wa-kwt-sv">
                {kwtTop10}
                <small>/{kwtRows.length}</small>
              </span>
              <span className="wa-kwt-sl">{t("na 1.ª página", "on page one")}</span>
            </div>
            <div className="wa-kwt-stat">
              <span className="wa-kwt-sv">{kwtTop3}</span>
              <span className="wa-kwt-sl">{t("no top 3", "in the top 3")}</span>
            </div>
            {showDeltas && (
              <div className="wa-kwt-stat">
                <span className={`wa-kwt-sv${kwtUp > 0 ? " up" : ""}`}>{kwtUp}</span>
                <span className="wa-kwt-sl">{t("a subir este mês", "moving up")}</span>
              </div>
            )}
            {kwtAvg !== null && (
              <div className="wa-kwt-stat">
                <span className="wa-kwt-sv">
                  {kwtAvg.toLocaleString(pt ? "pt-PT" : "en-GB", {
                    maximumFractionDigits: 1,
                  })}
                </span>
                <span className="wa-kwt-sl">{t("posição média", "avg. position")}</span>
              </div>
            )}
          </div>
          <div className="wa-kwt-head" aria-hidden>
            <span>{t("Posição", "Position")}</span>
            <span>Keyword</span>
            <span className="wa-kwt-scale">
              <i>1</i>
              <i>10</i>
              <i>100</i>
            </span>
            {showDeltas && <span className="r">{t("Δ mês", "MoM")}</span>}
          </div>
          <ol className="wa-kwt-list">
            {kwtRows.map(({ k, pos, change }) => (
              <li key={k.keyword} className={`wa-kwt-row ${rankBand(pos)}`}>
                <span className={`wa-kwt-rank ${rankBand(pos)}`}>
                  {rankText(pos, lang)}
                </span>
                <span className="wa-kwt-main">
                  <span className="wa-kwt-kw">
                    {k.keyword}
                    {k.premium && (
                      <span className="wa-kwt-star">
                        ★ {t("prioritária", "priority")}
                      </span>
                    )}
                  </span>
                  <span className="wa-kwt-meta">
                    <span className={`wa-kwt-src ${k.show}`}>
                      {pt ? KWT_SOURCE[k.show].pt : KWT_SOURCE[k.show].en}
                    </span>
                    {k.volume !== null && k.volume > 0 && (
                      <span>
                        {k.volume.toLocaleString(pt ? "pt-PT" : "en-GB")}{" "}
                        {t("pesquisas/mês", "searches/mo")}
                      </span>
                    )}
                    {pos === "out" && (
                      <span className="wa-kwt-wip">
                        {t("em trabalho — ainda fora do top 100", "in progress — not in the top 100 yet")}
                      </span>
                    )}
                    {variant === "internal" && (
                      <span className="wa-kwt-int">
                        S {rankText(k.semrush, lang)} · GSC {rankText(k.gsc, lang)} · G{" "}
                        {rankText(k.google, lang)}
                      </span>
                    )}
                  </span>
                </span>
                <RankTrack pos={pos} />
                {showDeltas && <MoveChip change={change} lang={lang} />}
              </li>
            ))}
          </ol>
          <p className="wa-method wa-kwt-legend">
            {kwtSources.includes("semrush") &&
              t(
                "Semrush — a posição que a ferramenta regista na Google. ",
                "Semrush — the position the tool records on Google. ",
              )}
            {kwtSources.includes("gsc") &&
              t(
                "Search Console — a posição média na Google ao longo do mês, medida pela própria Google. ",
                "Search Console — the average Google position over the month, measured by Google itself. ",
              )}
            {kwtSources.includes("google") &&
              t(
                `Pesquisa Google — verificada à mão pela equipa${kwt.googleLocation ? `, a partir de ${kwt.googleLocation}` : " na localização do cliente"}. `,
                `Google search — checked by hand by the team${kwt.googleLocation ? `, from ${kwt.googleLocation}` : " in the client's location"}. `,
              )}
            {t("«100+» = ainda fora das 100 primeiras posições.", "“100+” = not in the top 100 yet.")}
          </p>
        </section>
      )}

      {/* TODAS AS PESQUISAS ONDE O SITE APARECE — a lista do Serpstat
          (domínio + subdomínios, base regional). Entra como o consultor
          escolheu: toda (recomendado), só algumas, ou nada (v77.82). */}
      {showKw && kwVisible.length > 0 && (
        <section className="wa-sec">
          <SecLabel n={secN("kw")} id="wa-sec-kw">
            {t("Onde o site aparece", "Where the site shows up")}
          </SecLabel>
          <h2 className="wa-h2">
            {serpMode === "some"
              ? t(
                  `Outras pesquisas onde o site aparece na Google (${kwRanked.length})`,
                  `Other searches where the site shows up on Google (${kwRanked.length})`,
                )
              : t(
                  `Todas as pesquisas onde o site aparece na Google (${kwRanked.length})`,
                  `Every search where the site shows up on Google (${kwRanked.length})`,
                )}
          </h2>
          <p className="wa-method">
            {t(
              `Recolhidas automaticamente pelo Serpstat na região deste cliente — ${kwTop10} ${kwTop10 === 1 ? "está" : "estão"} na primeira página. Verificado a ${formatDate(
                live?.checkedOn ?? seRanking?.checkedOn ?? snapshot.generatedAt,
              )}.`,
              `Collected automatically by Serpstat in this client's region — ${kwTop10} on page one. Checked on ${formatDate(
                live?.checkedOn ?? seRanking?.checkedOn ?? snapshot.generatedAt,
              )}.`,
            )}
            {variant === "internal" && kwPending.length > 0 &&
              " " +
                t(
                  `As últimas ${kwPending.length} linhas são keywords do plano que ainda não entraram no top 100 (o cliente não as vê).`,
                  `The last ${kwPending.length} rows are plan keywords that haven't entered the top 100 yet (hidden from the client).`,
                )}
          </p>
          {/* «Ver todas» sem JavaScript: a caixa escondida abre as linhas
              dobradas; no PDF saem todas (ver PRINT_CSS). */}
          <input type="checkbox" id="wa-kw-more" className="wa-more-cb" />
          <div className="wa-tblwrap" style={{ marginTop: ".6rem" }}>
            <table className="wa-qtable">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th className="n">{t("Posição", "Position")}</th>
                  <th className="n">{t("Δ mês", "MoM Δ")}</th>
                  {variant === "internal" && <th className="n">KD</th>}
                </tr>
              </thead>
              <tbody>
                {kwVisible.map((k, i) => (
                  <tr key={k.keyword} className={i >= KW_FOLD ? "wa-fold" : undefined}>
                    <td>
                      {k.keyword}
                      {k.inPlan && (
                        <span className="wa-kw-plan">{t("plano", "plan")}</span>
                      )}
                      {variant === "internal" && k.manual && (
                        <span className="wa-kw-plan">manual</span>
                      )}
                      {k.citedInAio ? (
                        <span className="wa-kw-aio cited">
                          {t("citado na IA", "cited by AI")}
                        </span>
                      ) : k.aiOverview ? (
                        <span className="wa-kw-aio">AI Overview</span>
                      ) : null}
                    </td>
                    <td className="n">
                      {k.position === null ? (
                        <span className="wa-pending">
                          {t("fora do top 100", "outside top 100")}
                        </span>
                      ) : (
                        <PosPill pos={k.position} decimals={kwDecimals} />
                      )}
                    </td>
                    <td className="n">
                      <PlaceCell change={k.change} />
                    </td>
                    {variant === "internal" && (
                      <td className="n">
                        {k.difficulty === null ? "—" : k.difficulty}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {kwVisible.length > KW_FOLD && (
            <label htmlFor="wa-kw-more" className="wa-more-btn">
              <span className="wa-more-open">
                {t(
                  `Ver todas as ${kwVisible.length} pesquisas`,
                  `Show all ${kwVisible.length} searches`,
                )}
              </span>
              <span className="wa-more-close">{t("Mostrar menos", "Show less")}</span>
            </label>
          )}
          {variant === "internal" && live && (
            <p className="wa-method" style={{ marginTop: ".6rem" }}>
              {`Serpstat · base ${live.se ?? "g_pt"} · domínio + subdomínios · ${live.domain}${
                live.truncated
                  ? " · ⚠ cobertura truncada — posições em falta podem ser falta de cobertura"
                  : ""
              }${serpMode === "some" ? ` · modo «só algumas» (${pickedSet.size} escolhidas)` : ""}`}
            </p>
          )}
        </section>
      )}

      {/* A tabela do Serpstat ficou fora deste relatório por escolha do
          consultor — a vista interna lembra-o, o cliente não vê nada. */}
      {variant === "internal" && serpMode === "off" && !hidden.has("kw") && live && (
        <section className="wa-sec wa-sec-note">
          <p className="wa-method" style={{ margin: 0 }}>
            {`Tabela do Serpstat fora do relatório (${kwRanked.length + kwPending.length} pesquisas disponíveis). A app recomenda mostrá-la — quanta mais informação o cliente tiver, melhor.`}
          </p>
        </section>
      )}

      {/* SEM SERPSTAT NÃO HÁ TABELA. O consultor precisa de saber porquê —
          quase sempre são créditos da API esgotados — e o cliente não pode
          ver uma secção vazia nem números de outra fonte. */}
      {showKw && kwVisible.length === 0 && variant === "internal" && serpMode === "all" && (
        <section className="wa-sec">
          <SecLabel n={secN("kw")} id="wa-sec-kw">
            {t("Keywords Trabalhadas", "Target Keywords")}
          </SecLabel>
          <p className="wa-pending-lg">
            {t(
              "O Serpstat não devolveu posições para este relatório, por isso a tabela de keywords não sai. Verifica os créditos da API do Serpstat (SerpstatLimitsProcedure.getStats) e volta a gerar — não há fonte alternativa por decisão de produto.",
              "Serpstat returned no positions for this report, so the keyword table is omitted. Check the Serpstat API credits and regenerate — there is no alternative source by design.",
            )}
          </p>
        </section>
      )}

      {/* GEO v2 — o corpus de perguntas + a auditoria de prontidão. */}
      {showGeo && (
        <ReportGeoSection
          intel={geoIntel}
          aio={aioRows}
          aioCheckedOn={live?.checkedOn ?? null}
          lang={lang}
          variant={variant}
          sectionNumber={secN("geo")}
        />
      )}

      {/* Notes */}
      {showNotes && (
        <section className="wa-sec">
          <SecLabel n={secN("notes")} id="wa-sec-notes">
            {t("Notas & Próximos Passos", "Notes & Next Steps")}
          </SecLabel>
          {snapshot.notes.trim() ? (
            <p className="wa-notes">{linkify(snapshot.notes)}</p>
          ) : (
            <p className="wa-pending">{t("Sem notas — adicione o foco do próximo mês.", "No notes — add next month's focus.")}</p>
          )}
          {/* Prints e ficheiros anexados (v77.9): imagens em miniatura, o
              resto como chip com o nome. Vão para o cliente — é para isso
              que se anexam. */}
          {(snapshot.notesAttachments?.length ?? 0) > 0 && (
            <div className="wa-att">
              {(snapshot.notesAttachments ?? []).map((a) =>
                a.type.startsWith("image/") ? (
                  <a
                    key={a.url}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wa-att-img"
                    title={a.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.name} />
                  </a>
                ) : (
                  <a
                    key={a.url}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wa-att-file"
                    title={a.name}
                  >
                    <span aria-hidden>📎</span>
                    <span className="wa-att-name">{a.name}</span>
                  </a>
                ),
              )}
            </div>
          )}
        </section>
      )}

      {/* Footer band */}
      <footer className="wa-foot">
        {snapshot.consultant.name && (
          <div className="wa-foot-cta">
            <span className="wa-foot-q">
              {t("Dúvidas sobre este relatório?", "Questions about this report?")}
            </span>
            <span className="wa-foot-who">
              {t("Fala com", "Talk to")} <b>{snapshot.consultant.name}</b>
              {snapshot.consultant.email && (
                <>
                  {" · "}
                  <a href={`mailto:${snapshot.consultant.email}`}>
                    {snapshot.consultant.email}
                  </a>
                </>
              )}
            </span>
          </div>
        )}
        <div className="wa-foot-meta">
          <span className="wa-foot-brand">Wonder Ads</span>
          <span className="wa-foot-sub">
            {t("Relatório mensal de SEO & Leads", "Monthly SEO & Leads report")} · {snapshot.periodLabel}
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Regras de impressão. O PDF é o formato em que este relatório chega mais
 *  vezes ao cliente, e um cartão cortado a meio entre páginas estraga a
 *  leitura de tudo o que vem a seguir. */
const PRINT_CSS = `
@media print{
  .wa-report{box-shadow:none;border:none;border-radius:0;background:#fff;}
  .wa-sec{break-inside:auto;padding-top:1rem;padding-bottom:1rem;}
  .wa-h2,.wa-h3,.wa-label{break-after:avoid;}
  .wa-kpi,.wa-card,.wa-exec-card,.wa-geo-stat,.wa-geo-show,.wa-geo-pillar,
  .wa-geo-check,.wa-geo-bots,.wa-trend-panel,.wa-gbp-unit,.wa-top-row{break-inside:avoid;}
  .wa-ectable tr{break-inside:avoid;}
  .wa-qtable tr{break-inside:avoid;}
  .wa-qtable thead{display:table-header-group;}
  .wa-foot{break-inside:avoid;}
  .wa-nav,.wa-more-btn,.wa-more-cb{display:none!important;}
  .wa-qtable tr.wa-fold{display:table-row!important;}
  .wa-kwt-row,.wa-kwt-stat,.wa-exec li{break-inside:avoid;}
  .wa-sec{box-shadow:none!important;margin:0 0 .7rem!important;}
  .wa-kpis{margin-top:0!important;}
  .wa-cover{padding-bottom:2.2rem!important;}
}
`;

const CSS = GEO_CSS + PRINT_CSS + `
.wa-report{--ink:#17162d;--muted:#6d6b86;--line:rgba(23,22,45,.08);--violet:#783df5;--plum:#8a4fd0;--tint:#f7f5fe;--up:#0f8f62;--down:#c93a52;
  background:var(--tint);color:var(--ink);border-radius:18px;overflow:hidden;overflow:clip;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  box-shadow:0 24px 70px -34px rgba(23,22,45,.5);border:1px solid rgba(23,22,45,.06);}
.wa-report *{box-sizing:border-box;}

/* Cover */
.wa-cover{position:relative;color:#fff;padding:2.1rem 1.9rem 4.6rem;overflow:hidden;}
.wa-cover::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:radial-gradient(rgba(255,255,255,.16) 1px,transparent 1px);background-size:18px 18px;
  -webkit-mask-image:linear-gradient(115deg,transparent 35%,#000 100%);mask-image:linear-gradient(115deg,transparent 35%,#000 100%);}
.wa-cover::after{content:"";position:absolute;right:-70px;top:-70px;width:230px;height:230px;border-radius:50%;
  background:radial-gradient(circle at center,rgba(255,255,255,.22),transparent 68%);pointer-events:none;}
.wa-cover-top{display:flex;align-items:center;justify-content:space-between;gap:1rem;position:relative;z-index:1;}
.wa-cbrand{display:flex;align-items:center;gap:.55rem;font-weight:700;font-size:.95rem;letter-spacing:.01em;}
.wa-cglyph{width:30px;height:30px;border-radius:8px;background:#fff;padding:4px;object-fit:contain;display:inline-block;box-shadow:0 4px 12px -4px rgba(0,0,0,.35);}
.wa-cbadge{display:inline-block;padding:.32rem .7rem;border-radius:999px;font-size:.72rem;font-weight:700;
  background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);font-variant-numeric:tabular-nums;backdrop-filter:blur(2px);}
.wa-ckicker{margin-top:1.7rem;font-size:.7rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.8;position:relative;z-index:1;}
.wa-ctitle{margin:.35rem 0 0;font-size:2.35rem;letter-spacing:-.035em;font-weight:800;line-height:1.02;position:relative;z-index:1;}
.wa-cmeta{font-size:1rem;font-weight:600;opacity:.97;position:relative;z-index:1;}
.wa-cconsult{margin-top:1rem;display:inline-flex;align-items:center;gap:.55rem;font-size:.74rem;position:relative;z-index:1;
  padding:.3rem .75rem .3rem .3rem;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);}
.wa-cconsult b{font-weight:700;}
.wa-cavatar{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;
  background:#fff;color:#6b34c9;font-weight:800;font-size:.72rem;}

/* Hero KPI band */
.wa-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem;padding:0 1.6rem 1.2rem;
  margin-top:-3rem;position:relative;z-index:2;}
/* Cinco cartões: 3 em cima, 2 em baixo, todos com largura útil — nunca um
   órfão sozinho na segunda linha (v77.82). */
.wa-kpis.n5{grid-template-columns:repeat(6,1fr);}
.wa-kpis.n5 .wa-kpi{grid-column:span 2;}
.wa-kpis.n5 .wa-kpi:nth-child(n+4){grid-column:span 3;}
.wa-kpis.n4{grid-template-columns:repeat(4,1fr);}
.wa-kpis.n3{grid-template-columns:repeat(3,1fr);}
.wa-kpi{position:relative;background:#fff;border:1px solid var(--line);border-radius:14px;padding:.95rem 1rem 1rem;overflow:hidden;
  box-shadow:0 18px 40px -26px rgba(23,22,45,.55);}
.wa-kpi::before{content:"";position:absolute;left:0;top:0;height:3px;width:100%;background:${"linear-gradient(90deg,#343ED7,#783DF5,#C535C9)"};}
.wa-kpi-l{font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--plum);}
.wa-kpi-v{font-size:1.9rem;font-weight:800;letter-spacing:-.03em;line-height:1.05;margin:.35rem 0 .4rem;color:var(--ink);font-variant-numeric:tabular-nums;}
.wa-kpi-dash{color:#c7c2d6;}
.wa-kpi-note{font-size:.66rem;color:#a08fb8;font-style:italic;}

/* Numeração de secções (v76.57) */
.wa-secn{display:inline-block;margin-right:.45rem;padding:.05rem .3rem;border-radius:4px;font-size:.6rem;font-weight:800;
  background:rgba(120,61,245,.12);color:#6b34c9;font-variant-numeric:tabular-nums;letter-spacing:.04em;vertical-align:.05em;}
.wa-label-on-tint .wa-secn{background:rgba(107,52,201,.16);}

/* Sparkline dentro do KPI */
.wa-spark{display:block;width:100%;height:22px;margin-top:.5rem;overflow:visible;}
.wa-spark path{stroke:var(--violet);opacity:.55;}
.wa-spark circle{fill:var(--violet);}

/* Pastilha de posição */
.wa-kw-plan{margin-left:.4rem;padding:.05rem .32rem;border-radius:4px;font-size:.6rem;font-weight:800;letter-spacing:.05em;
  text-transform:uppercase;background:rgba(120,61,245,.12);color:#6b34c9;}
.wa-kw-aio{margin-left:.35rem;padding:.05rem .32rem;border-radius:4px;font-size:.6rem;font-weight:800;letter-spacing:.05em;
  text-transform:uppercase;background:rgba(23,22,45,.06);color:#5c5a72;}
.wa-kw-aio.cited{background:rgba(15,143,98,.14);color:#0b6f4c;}
.wa-pos{display:inline-block;min-width:2.1rem;padding:.1rem .38rem;border-radius:6px;font-weight:800;font-size:.76rem;
  font-variant-numeric:tabular-nums;text-align:center;}
.wa-pos.p1{background:rgba(15,143,98,.14);color:#0b6f4c;}
.wa-pos.p2{background:rgba(52,62,215,.12);color:#2f38b8;}
.wa-pos.p3{background:rgba(201,138,21,.14);color:#8a5a1f;}
.wa-pos.p4{background:rgba(23,22,45,.06);color:#5c5a72;}

/* Sections */
/* SECÇÕES EM CARTÃO (v77.82): cada secção é um bloco branco sobre o fundo
   lilás, com espaço entre elas — lê-se como um painel, não como uma folha
   contínua. Os cartões de dentro passam a um lilás muito claro. */
.wa-sec{padding:1.35rem 1.45rem;margin:0 1.1rem 1rem;background:#fff;border:1px solid var(--line);border-radius:16px;
  box-shadow:0 14px 34px -30px rgba(23,22,45,.45);}
.wa-sec .wa-card,.wa-sec .wa-trend-panel,.wa-sec .wa-ai-card,.wa-sec .wa-kstat,.wa-sec .wa-top-row,
.wa-sec .wa-geo-stat,.wa-sec .wa-geo li{background:#fbfaff;box-shadow:none;}
.wa-sec-note{background:transparent;border-style:dashed;box-shadow:none;padding:.8rem 1.1rem;}
.wa-two-sp{margin-top:.55rem;}
.wa-label[id]{scroll-margin-top:64px;}
.wa-label{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--plum);font-weight:700;}
.wa-h2{margin:.4rem 0 .7rem;font-size:1.22rem;letter-spacing:-.02em;font-weight:750;line-height:1.25;}
.wa-h3{margin:.2rem 0 .6rem;font-size:.95rem;letter-spacing:-.01em;font-weight:700;}

/* Executive summary — wins ribbon */
.wa-exec-card{background:linear-gradient(135deg,rgba(52,62,215,.07),rgba(197,53,201,.07));
  border:1px solid rgba(120,61,245,.16);border-radius:14px;padding:1.05rem 1.15rem;}
/* O resumo já é um cartão — a secção à volta não leva outro. */
.wa-sec:has(> .wa-exec-card){background:transparent;border:none;box-shadow:none;padding:0;}
.wa-label-on-tint{color:#6b34c9;}
.wa-exec-h{margin-bottom:.2rem;}
.wa-exec{margin:.6rem 0 0;padding:0;display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));}
.wa-exec li{list-style:none;display:flex;gap:.65rem;align-items:flex-start;font-size:.88rem;color:#2f2e3d;line-height:1.5;
  background:rgba(255,255,255,.78);border:1px solid rgba(120,61,245,.14);border-radius:12px;padding:.75rem .85rem;}
.wa-exec-ic{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;
  background:${GRAD};color:#fff;font-size:.7rem;font-weight:800;margin-top:.05rem;}

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
.wa-method{margin:.15rem 0 .8rem;font-size:.74rem;line-height:1.55;color:var(--muted);}

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

/* Visibilidade em IA */
.wa-geo{list-style:none;margin:.5rem 0 0;padding:0;display:grid;gap:.4rem;}
.wa-geo li{border:1px solid var(--line);border-radius:9px;padding:.5rem .7rem;background:#fff;
  display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem;break-inside:avoid;}
.wa-geo-hit{border-color:rgba(15,143,98,.28)!important;background:rgba(15,143,98,.05)!important;}
.wa-geo-gap{background:rgba(120,61,245,.035)!important;}
.wa-geo-q{font-size:.82rem;color:#2c2a45;font-weight:600;flex:1 1 auto;}
.wa-geo-v{font-size:.72rem;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;}
.wa-geo-src{flex:1 0 100%;font-size:.68rem;color:#a08fb8;}
.wa-geo-h{margin:1.1rem 0 .1rem;font-size:.95rem;font-weight:700;letter-spacing:-.01em;color:var(--ink);}

/* AI */
.wa-ai-total{display:flex;align-items:baseline;gap:.5rem;margin:.2rem 0 .85rem;}
.wa-ai-total-v{font-size:1.7rem;font-weight:800;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums;}
.wa-ai-total-l{font-size:.78rem;color:#45435c;}
.wa-ai-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.65rem;}
.wa-ai-card{border:1px solid rgba(120,61,245,.16);background:#fff;border-radius:11px;padding:.75rem .85rem;box-shadow:0 8px 22px -22px rgba(23,22,45,.5);}
.wa-ai-src{font-size:.72rem;font-weight:700;color:#6b34c9;}
.wa-ai-sess{font-size:1.4rem;font-weight:800;color:var(--ink);line-height:1.1;margin:.15rem 0 .1rem;font-variant-numeric:tabular-nums;}
.wa-ai-native{margin:-.45rem 0 .85rem;font-size:.76rem;color:var(--muted);}
.wa-ai-flag{margin-top:.2rem;font-size:.6rem;letter-spacing:.04em;text-transform:uppercase;color:#a08fb8;font-weight:700;}

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

/* Conversão e-commerce — a tabela que o cliente já conhece: meses lado a
   lado, homólogo em cinza no fim, a linha da receita em destaque. */
.wa-ectable{margin-top:.4rem;font-size:.78rem;}
.wa-ectable th{font-size:.62rem;padding:.44rem .55rem;}
.wa-ectable td{padding:.5rem .55rem;}
.wa-ectable td.wa-ec-desc{font-weight:700;color:var(--ink);text-transform:uppercase;font-size:.68rem;letter-spacing:.06em;}
.wa-ectable th.wa-ec-yoy,.wa-ectable td.wa-ec-yoy{background:rgba(23,22,45,.055);}
.wa-ectable th.wa-ec-yoy{color:#5c5a72;}
.wa-ectable tr.wa-ec-rev td{background:rgba(15,143,98,.10);font-weight:700;}
.wa-ectable tr.wa-ec-rev td.wa-ec-yoy{background:rgba(15,143,98,.16);}

/* Google IA — hero com o número grande + sparkline dos últimos meses. */
.wa-gai-hero{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:1rem;margin:.2rem 0 .2rem;}
.wa-gai-num{display:flex;align-items:baseline;gap:.55rem;flex-wrap:wrap;}
.wa-gai-v{font-size:2.1rem;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1;
  background:linear-gradient(135deg,#343ED7,#783DF5,#C535C9);-webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;color:transparent;}
.wa-gai-l{font-size:.8rem;color:var(--muted);font-weight:600;}
.wa-gai-spark{min-width:150px;flex:0 1 220px;}
.wa-gai-spark .wa-spark{height:30px;margin-top:0;}
.wa-gai-spark-l{display:block;margin-top:.2rem;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#a09eb4;font-weight:700;text-align:right;}

/* Top 10 (páginas / produtos) — rank, nome, barra, valor. */
.wa-toplist{display:grid;gap:.45rem;margin-top:.4rem;}
.wa-top-row{display:grid;grid-template-columns:1.4rem minmax(140px,1.4fr) 1fr 96px;gap:.6rem;align-items:center;
  font-size:.78rem;border:1px solid var(--line);border-radius:9px;background:#fff;padding:.42rem .6rem;break-inside:avoid;}
.wa-top-n{font-weight:800;color:var(--plum);font-variant-numeric:tabular-nums;text-align:right;}
.wa-top-name{color:#34333f;min-width:0;overflow-wrap:anywhere;}
.wa-top-qty{margin-left:.4rem;padding:.02rem .32rem;border-radius:5px;font-size:.62rem;font-weight:700;
  background:rgba(23,22,45,.06);color:#5c5a72;white-space:nowrap;}
.wa-top-bar{height:8px;border-radius:5px;background:rgba(23,22,45,.06);overflow:hidden;}
.wa-top-bar i{display:block;height:100%;border-radius:5px;}
.wa-top-v{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink);white-space:nowrap;}

/* Tables */
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
/* Castanho-âmbar sobre o gradiente roxo da capa era ilegível — a cor que
   funciona num fundo claro desaparece neste. Aqui o aviso é branco sobre um
   véu escuro, que é o que se lê em cima de qualquer ponto do gradiente. */
.wa-cpartial{position:relative;z-index:1;margin-top:.75rem;display:inline-block;padding:.36rem .7rem;border-radius:8px;
  background:rgba(23,22,45,.28);border:1px solid rgba(255,255,255,.42);backdrop-filter:blur(2px);
  color:#fff;font-size:.7rem;font-weight:600;line-height:1.45;}
.wa-kw-new{display:inline-block;margin-left:.34rem;padding:0 .3rem;border-radius:6px;
  background:rgba(22,163,74,.12);color:#15803d;font-size:.56rem;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;vertical-align:middle;}
.wa-kw-map{display:inline-block;margin-left:.34rem;padding:0 .3rem;border-radius:6px;
  background:rgba(120,61,245,.12);color:var(--violet);font-size:.56rem;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;vertical-align:middle;}
.wa-notes{font-size:.86rem;color:#34333f;line-height:1.55;white-space:pre-wrap;margin:.3rem 0 0;}
.wa-notes a{color:var(--violet);text-decoration:underline;text-underline-offset:2px;word-break:break-all;}
.wa-att{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.8rem;}
.wa-att-img{display:block;width:180px;height:120px;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#f6f5fb;}
.wa-att-img img{width:100%;height:100%;object-fit:cover;display:block;}
.wa-att-file{display:inline-flex;align-items:center;gap:.4rem;max-width:260px;padding:.45rem .7rem;border-radius:999px;
  border:1px solid var(--line);background:#fff;font-size:.76rem;color:#34333f;text-decoration:none;}
.wa-att-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.wa-lead-split{display:flex;flex-wrap:wrap;gap:1rem;margin:.35rem 0 0;font-size:.82rem;color:#5b5970;}
.wa-lead-split b{color:var(--ink);}

/* Footer */
.wa-foot{padding:1.2rem 1.6rem 1.3rem;border-top:1px solid var(--line);background:#fff;margin-top:.4rem;}
.wa-foot-cta{display:flex;flex-direction:column;gap:.15rem;padding:.9rem 1rem;margin-bottom:1rem;border-radius:12px;
  background:linear-gradient(135deg,rgba(52,62,215,.06),rgba(197,53,201,.06));border:1px solid rgba(120,61,245,.14);}
.wa-foot-q{font-size:.9rem;font-weight:700;color:var(--ink);}
.wa-foot-who{font-size:.8rem;color:#45435c;}
.wa-foot-who a{color:var(--violet);text-decoration:none;font-weight:600;}
.wa-foot-meta{display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;}
.wa-foot-brand{font-weight:800;font-size:.9rem;background:${GRAD};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}
.wa-foot-sub{font-size:.72rem;color:var(--muted);font-variant-numeric:tabular-nums;}

/* Índice fixo do cliente (v77.82) */
.wa-nav{position:sticky;top:0;z-index:5;display:flex;gap:.35rem;overflow-x:auto;scrollbar-width:none;
  margin:0 0 1rem;padding:.6rem 1.1rem;background:rgba(247,245,254,.88);backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line);}
.wa-nav::-webkit-scrollbar{display:none;}
.wa-nav a{flex:0 0 auto;padding:.32rem .7rem;border-radius:999px;font-size:.72rem;font-weight:600;color:#4a4863;
  text-decoration:none;background:#fff;border:1px solid var(--line);white-space:nowrap;transition:all .15s;}
.wa-nav a:hover{color:#fff;background:${GRAD};border-color:transparent;}

/* Keyword tracking (v77.82) */
.wa-kwt-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin:.2rem 0 1rem;}
.wa-kwt-stat{border:1px solid var(--line);border-radius:12px;padding:.7rem .85rem;background:#fbfaff;}
.wa-kwt-stat.hero{background:${GRAD};border-color:transparent;color:#fff;}
.wa-kwt-sv{display:block;font-size:1.65rem;font-weight:800;letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums;}
.wa-kwt-sv small{font-size:.9rem;font-weight:700;opacity:.7;}
.wa-kwt-sv.up{color:var(--up);}
.wa-kwt-sl{display:block;margin-top:.2rem;font-size:.6rem;letter-spacing:.09em;text-transform:uppercase;font-weight:700;color:var(--plum);}
.wa-kwt-stat.hero .wa-kwt-sl{color:rgba(255,255,255,.85);}
.wa-kwt-head,.wa-kwt-row{display:grid;grid-template-columns:3.1rem minmax(0,1.5fr) minmax(90px,1fr) 4.6rem;gap:.8rem;align-items:center;}
.wa-kwt-head{padding:0 .7rem .35rem;font-size:.56rem;letter-spacing:.09em;text-transform:uppercase;font-weight:700;color:var(--plum);}
.wa-kwt-head .r{text-align:right;}
.wa-kwt-scale{display:flex;justify-content:space-between;color:#a09eb4;}
.wa-kwt-scale i{font-style:normal;}
.wa-kwt-list{list-style:none;margin:0;padding:0;display:grid;gap:.4rem;}
.wa-kwt-row{padding:.55rem .7rem;border:1px solid var(--line);border-radius:12px;background:#fff;}
.wa-kwt-row.p1{border-color:rgba(15,143,98,.22);background:linear-gradient(90deg,rgba(15,143,98,.05),#fff 60%);}
.wa-kwt-rank{display:inline-flex;align-items:center;justify-content:center;height:2.3rem;border-radius:10px;font-weight:800;
  font-size:1rem;font-variant-numeric:tabular-nums;letter-spacing:-.02em;}
.wa-kwt-rank.p1{background:rgba(15,143,98,.14);color:#0b6f4c;}
.wa-kwt-rank.p2{background:rgba(52,62,215,.12);color:#2f38b8;}
.wa-kwt-rank.p3{background:rgba(201,138,21,.14);color:#8a5a1f;}
.wa-kwt-rank.p4,.wa-kwt-rank.p5{background:rgba(23,22,45,.06);color:#5c5a72;font-size:.85rem;}
.wa-kwt-main{display:flex;flex-direction:column;gap:.18rem;min-width:0;}
.wa-kwt-kw{font-size:.86rem;font-weight:650;color:var(--ink);overflow-wrap:anywhere;}
.wa-kwt-star{margin-left:.4rem;padding:.04rem .34rem;border-radius:5px;font-size:.58rem;font-weight:800;letter-spacing:.04em;
  text-transform:uppercase;background:rgba(197,53,201,.12);color:#9a2aa0;vertical-align:.1em;}
.wa-kwt-meta{display:flex;flex-wrap:wrap;gap:.25rem .6rem;align-items:center;font-size:.68rem;color:var(--muted);}
.wa-kwt-src{padding:.02rem .36rem;border-radius:5px;font-weight:700;font-size:.6rem;letter-spacing:.03em;}
.wa-kwt-src.semrush{background:rgba(255,100,45,.12);color:#b4441a;}
.wa-kwt-src.gsc{background:rgba(52,62,215,.1);color:#2f38b8;}
.wa-kwt-src.google{background:rgba(15,143,98,.12);color:#0b6f4c;}
.wa-kwt-wip{font-style:italic;color:#a08fb8;}
.wa-kwt-int{font-variant-numeric:tabular-nums;color:#a09eb4;}
.wa-track{position:relative;display:block;height:8px;border-radius:5px;background:rgba(23,22,45,.06);}
.wa-track-p1{position:absolute;left:0;top:0;bottom:0;width:50%;border-radius:5px 0 0 5px;
  background:linear-gradient(90deg,rgba(15,143,98,.22),rgba(15,143,98,.06));}
.wa-track-dot{position:absolute;top:50%;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;
  border:2px solid #fff;box-shadow:0 1px 4px rgba(23,22,45,.3);}
.wa-track-dot.p1{background:#0f8f62;}
.wa-track-dot.p2{background:#343ed7;}
.wa-track-dot.p3{background:#c98a15;}
.wa-track-dot.p4,.wa-track-dot.p5{background:#9a97ae;}
.wa-move{justify-self:end;font-size:.74rem;font-weight:800;font-variant-numeric:tabular-nums;padding:.16rem .42rem;border-radius:6px;white-space:nowrap;}
.wa-move.up{color:var(--up);background:rgba(15,157,107,.12);}
.wa-move.down{color:var(--down);background:rgba(209,67,90,.1);}
.wa-move.flat{color:#a5a2b8;}
.wa-kwt-legend{margin-top:.8rem;margin-bottom:0;}

/* «Ver todas» sem JS (v77.82) */
.wa-more-cb{position:absolute;opacity:0;pointer-events:none;width:0;height:0;}
.wa-qtable tr.wa-fold{display:none;}
.wa-more-cb:checked ~ .wa-tblwrap tr.wa-fold{display:table-row;}
.wa-more-btn{display:inline-flex;align-items:center;gap:.35rem;margin-top:.7rem;padding:.45rem .9rem;border-radius:999px;cursor:pointer;
  font-size:.76rem;font-weight:700;color:#6b34c9;background:rgba(120,61,245,.08);border:1px solid rgba(120,61,245,.2);user-select:none;}
.wa-more-btn:hover{background:rgba(120,61,245,.14);}
.wa-more-close{display:none;}
.wa-more-cb:checked ~ .wa-more-btn .wa-more-open{display:none;}
.wa-more-cb:checked ~ .wa-more-btn .wa-more-close{display:inline;}

@media (max-width:640px){
  .wa-two{grid-template-columns:1fr;}
  .wa-chan-row{grid-template-columns:110px 1fr 60px;}
  .wa-ctitle{font-size:1.7rem;}
  .wa-cover{padding:1.6rem 1.2rem 4.2rem;}
  .wa-kpis,.wa-kpis.n3,.wa-kpis.n4,.wa-kpis.n5{grid-template-columns:repeat(2,1fr);padding:0 1rem 1rem;}
  .wa-kpis.n5 .wa-kpi,.wa-kpis.n5 .wa-kpi:nth-child(n+4){grid-column:auto;}
  .wa-kpis.n5 .wa-kpi:first-child{grid-column:span 2;}
  .wa-sec{margin:0 .6rem .8rem;padding:1.1rem 1rem;}
  .wa-kwt-head{display:none;}
  .wa-kwt-row{grid-template-columns:2.7rem minmax(0,1fr) auto;}
  .wa-kwt-row .wa-track{grid-column:2 / span 2;grid-row:2;}
}
@media print{
  .wa-report{box-shadow:none;border:none;border-radius:0;background:#fff;}
  .wa-kpi,.wa-card,.wa-ai-card,.wa-kstat{box-shadow:none;}
}
`;
