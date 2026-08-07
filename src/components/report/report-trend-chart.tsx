// Gráfico de evolução do relatório mensal — os últimos 12 meses.
//
// DECISÕES QUE NÃO SÃO DE GOSTO:
//
//  • SVG INLINE, SEM JAVASCRIPT. Isto é impresso num PDF por um browser
//    headless e servido numa página pública sem interação. Uma biblioteca de
//    gráficos desenharia nada no PDF; um canvas sairia a preto.
//  • UM GRÁFICO POR MÉTRICA, NUNCA DOIS EIXOS. Utilizadores orgânicos andam
//    nos milhares e os leads nas dezenas: postos no mesmo eixo, a linha dos
//    leads fica colada ao fundo e o cliente conclui que não há leads. Cada
//    métrica tem o seu painel, com o seu título e a sua escala.
//  • UMA SÓ COR. Cada painel tem uma série, identificada pelo título por
//    cima dela. Pintar cada painel de uma cor diferente inventaria um código
//    de cores que não quer dizer nada — e as três cores da marca falham a
//    separação para daltónicos quando postas lado a lado.
//  • ESCALA UNIFORME (`preserveAspectRatio` por defeito) E RÓTULOS DENTRO DO
//    SVG. Com `preserveAspectRatio="none"` os pontos saíam esmagados em
//    tracinhos e os meses em HTML por baixo não caíam por cima dos pontos:
//    doze caixas centradas ficam a meio de cada fatia, os pontos ficam nas
//    fronteiras. Desenhado no mesmo sistema de coordenadas, cada mês fica
//    exatamente por baixo do seu ponto.

import type { ReportTrend } from "@/lib/report/report-types";

type Series = {
  key: string;
  label: string;
  values: (number | null)[];
};

const VIOLET = "#783df5";

/** Geometria do painel, em unidades de viewBox. ~5:1 — alto que chegue para
 *  uma subida se ver, baixo que chegue para três painéis caberem na página. */
const W = 560;
const H = 112;
const PAD_L = 12;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 22;
const BASE_Y = H - PAD_B;

const nf = (lang: "pt" | "en") =>
  new Intl.NumberFormat(lang === "pt" ? "pt-PT" : "en-GB", {
    maximumFractionDigits: 0,
  });

/** Índices dos meses com valor — a linha só existe onde houve medição. */
function definedPoints(values: (number | null)[]): number[] {
  const out: number[] = [];
  values.forEach((v, i) => {
    if (v !== null && Number.isFinite(v)) out.push(i);
  });
  return out;
}

function TrendPanel({
  series,
  labels,
  lang,
}: {
  series: Series;
  labels: string[];
  lang: "pt" | "en";
}) {
  const pts = definedPoints(series.values);
  const n = series.values.length;
  const fmt = nf(lang);

  // Escala sempre ancorada em 0. Uma linha que arranca no mínimo da série
  // transforma uma subida de 3% numa montanha — é a forma mais fácil de
  // mentir num relatório sem escrever um número errado.
  const max = Math.max(1, ...pts.map((i) => series.values[i] ?? 0));
  const x = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(1, n - 1);
  const y = (v: number) => PAD_T + (1 - v / max) * (BASE_Y - PAD_T);

  const line = pts
    .map(
      (i, k) =>
        `${k === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(series.values[i] ?? 0).toFixed(1)}`,
    )
    .join(" ");
  const area =
    pts.length > 1
      ? `${line} L${x(pts[pts.length - 1]).toFixed(1)},${BASE_Y} L${x(pts[0]).toFixed(1)},${BASE_Y} Z`
      : "";

  const lastIdx = pts.length ? pts[pts.length - 1] : null;
  const lastValue = lastIdx === null ? null : (series.values[lastIdx] ?? 0);
  // O pico só se marca quando não é o último ponto — senão são dois rótulos
  // em cima um do outro a dizer o mesmo número.
  const peakIdx = pts.reduce<number | null>(
    (best, i) =>
      best === null || (series.values[i] ?? 0) > (series.values[best] ?? 0)
        ? i
        : best,
    null,
  );
  const showPeak =
    peakIdx !== null &&
    lastIdx !== null &&
    peakIdx !== lastIdx &&
    (series.values[peakIdx] ?? 0) > (lastValue ?? 0);

  const gid = `wa-tg-${series.key}`;
  const enough = pts.length >= 2;

  return (
    <div className="wa-trend-panel">
      <div className="wa-trend-head">
        <span className="wa-trend-name">{series.label}</span>
        <span className="wa-trend-last">
          {lastValue === null ? "—" : fmt.format(lastValue)}
        </span>
      </div>
      {!enough ? (
        <p className="wa-pending">
          {lang === "pt"
            ? "Ainda sem histórico suficiente para desenhar a evolução."
            : "Not enough history yet to draw the trend."}
        </p>
      ) : (
        <svg
          className="wa-trend-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${series.label}: ${labels
            .map(
              (l, i) =>
                `${l} ${series.values[i] === null ? "—" : fmt.format(series.values[i] ?? 0)}`,
            )
            .join(", ")}`}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VIOLET} stopOpacity="0.20" />
              <stop offset="100%" stopColor={VIOLET} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Régua do máximo — sem ela a altura da linha não se consegue ler,
              só a forma. Com ela, o pico tem número. */}
          <line
            x1={PAD_L}
            y1={y(max)}
            x2={W - PAD_R}
            y2={y(max)}
            stroke="rgba(23,22,45,.10)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {/* À ESQUERDA, de propósito: encostado à direita ficava debaixo do
              número grande do cabeçalho e os dois liam-se como um par. */}
          <text x={PAD_L} y={y(max) - 3.5} textAnchor="start" className="wa-trend-max">
            {fmt.format(max)}
          </text>

          {/* Linha de base (zero). */}
          <line
            x1={PAD_L}
            y1={BASE_Y}
            x2={W - PAD_R}
            y2={BASE_Y}
            stroke="rgba(23,22,45,.14)"
            strokeWidth="1"
          />

          {area && <path d={area} fill={`url(#${gid})`} />}
          <path
            d={line}
            fill="none"
            stroke={VIOLET}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {showPeak && peakIdx !== null && (
            <circle
              cx={x(peakIdx)}
              cy={y(series.values[peakIdx] ?? 0)}
              r="3.2"
              fill="#fff"
              stroke={VIOLET}
              strokeWidth="2"
            />
          )}
          {lastIdx !== null && (
            <circle
              cx={x(lastIdx)}
              cy={y(lastValue ?? 0)}
              r="3.8"
              fill={VIOLET}
              stroke="#fff"
              strokeWidth="2"
            />
          )}

          {/* Meses — no mesmo sistema de coordenadas dos pontos, por isso cada
              um cai mesmo por baixo do seu. Os das pontas encostam para dentro
              para não saírem do painel. */}
          {labels.map((l, i) => (
            <text
              key={`${l}-${i}`}
              x={x(i)}
              y={H - 7}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              className="wa-trend-tick"
            >
              {l}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

export function ReportTrendChart({
  trend,
  lang,
}: {
  trend: ReportTrend;
  lang: "pt" | "en";
}) {
  const t = (pt: string, en: string) => (lang === "pt" ? pt : en);

  const candidates: Series[] = [
    {
      key: "users",
      label: t("Utilizadores orgânicos", "Organic users"),
      values: trend.organicUsers,
    },
    { key: "leads", label: t("Leads", "Leads"), values: trend.leads },
    {
      key: "clicks",
      label: t("Cliques na Google", "Google clicks"),
      values: trend.gscClicks,
    },
  ];

  // Uma série toda a zero (ou toda vazia) não é evolução nenhuma — mostrar um
  // painel achatado só ocupa meia página a dizer que não há nada.
  const series = candidates.filter((s) =>
    s.values.some((v) => v !== null && v > 0),
  );
  if (series.length === 0) return null;

  return (
    <div className="wa-trend">
      {series.map((s) => (
        <TrendPanel key={s.key} series={s} labels={trend.labels} lang={lang} />
      ))}
    </div>
  );
}
