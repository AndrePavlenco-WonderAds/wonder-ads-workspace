// Keyword Research backtesting / confidence layer.
//
// Compares a client's most recent keyword-research output (the DataforSEO
// predictions Claude clustered) against what the site ACTUALLY earned in
// Google Search Console over the following window. Produces a per-keyword
// comparison + an overall confidence score for the DataforSEO data, and a
// short prompt-ready summary that the NEXT research run injects so future
// recommendation weighting learns from past accuracy.
//
// Deterministic — no AI needed for the numbers. GSC is the ground truth.

import { listHistory } from "../action-history";
import { getQueryPerformance } from "../gsc";
import { normalizeKwKey } from "./keyword-research";
import type { KwClusterRow } from "../kw-cluster-parser";

export type BacktestKeyword = {
  keyword: string;
  predictedVolume: number | null;
  predictedKd: number | null;
  intent: string | null;
  /** Actuals from GSC (null when the query earned no impressions). */
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  position: number | null;
  /** Outcome bucket. */
  status:
    | "ranking" // ranks (position present) — prediction validated
    | "impressions-only" // gets impressions but weak position
    | "no-presence"; // predicted demand, zero GSC presence (yet)
  /** A short, human-readable verdict tag. */
  flag?: "over-estimate" | "under-estimate" | "ctr-opportunity";
};

export type KwBacktestReport = {
  slug: string;
  sourceResultId: string | null;
  sourceDate: number | null;
  gscWindowDays: number;
  totalKeywords: number;
  matched: number; // earned any impressions
  ranking: number; // has a position
  coveragePct: number; // matched / total
  overEstimates: number;
  underEstimates: number;
  ctrOpportunities: number;
  /** 0–100 confidence in the DataforSEO outputs for this client. */
  confidenceScore: number;
  keywords: BacktestKeyword[];
  generatedAt: number;
};

const HIGH_VOLUME = 100; // ≥ this predicted vol but no GSC presence = suspect
const HIGH_IMPRESSIONS = 50; // ≥ this impressions but ~no predicted vol = under-est
/** Rough "expected CTR" ceiling by position bucket — below it = opportunity. */
function expectedCtr(position: number): number {
  if (position <= 1) return 0.25;
  if (position <= 3) return 0.12;
  if (position <= 5) return 0.06;
  if (position <= 10) return 0.03;
  return 0.01;
}

/** Pull the researched keywords from the latest KR history entry. Prefers
 *  the parsed clusters (the actual recommendations); falls back to the raw
 *  pack's suggestions + ideas. */
function latestResearchKeywords(
  entries: Awaited<ReturnType<typeof listHistory>>,
): {
  resultId: string | null;
  date: number | null;
  rows: {
    keyword: string;
    volume: number | null;
    difficulty: number | null;
    intent: string | null;
  }[];
} {
  const entry = entries.find(
    (e) =>
      (e.kwClusters && e.kwClusters.length > 0) ||
      (e.kwResearch &&
        (e.kwResearch.suggestions.length > 0 ||
          e.kwResearch.ideas.length > 0)),
  );
  if (!entry) return { resultId: null, date: null, rows: [] };

  const rows: {
    keyword: string;
    volume: number | null;
    difficulty: number | null;
    intent: string | null;
  }[] = [];

  if (entry.kwClusters && entry.kwClusters.length > 0) {
    for (const c of entry.kwClusters) {
      for (const r of c.rows as KwClusterRow[]) {
        if (r.keyword)
          rows.push({
            keyword: r.keyword,
            volume: r.volume,
            difficulty: r.difficulty,
            intent: r.intent,
          });
      }
    }
  } else if (entry.kwResearch) {
    for (const k of [
      ...entry.kwResearch.suggestions,
      ...entry.kwResearch.ideas,
    ]) {
      rows.push({
        keyword: k.keyword,
        volume: k.searchVolume,
        difficulty: k.difficulty,
        intent: k.intent,
      });
    }
  }

  // Dedupe by normalized key.
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = normalizeKwKey(r.keyword);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    resultId: entry.id ?? null,
    date: entry.createdAt ?? null,
    rows: deduped.slice(0, 400),
  };
}

export async function runKwBacktest(
  slug: string,
): Promise<KwBacktestReport | { error: string }> {
  const history = await listHistory(slug, "keyword-research");
  const { resultId, date, rows } = latestResearchKeywords(history);
  if (rows.length === 0) {
    return {
      error:
        "Sem keyword research anterior com keywords para fazer backtest. Corre uma KW Research primeiro.",
    };
  }

  const perf = await getQueryPerformance(slug, 90, 1000);
  if (perf.status !== "ok") {
    return {
      error:
        perf.status === "not-configured"
          ? "GSC não configurado neste ambiente."
          : perf.status === "no-property"
            ? "Sem propriedade GSC correspondente a este cliente."
            : `GSC indisponível: ${perf.message}`,
    };
  }

  const actualByKey = new Map<string, (typeof perf.rows)[number]>();
  for (const r of perf.rows) actualByKey.set(normalizeKwKey(r.query), r);

  const keywords: BacktestKeyword[] = [];
  let matched = 0;
  let ranking = 0;
  let overEstimates = 0;
  let underEstimates = 0;
  let ctrOpportunities = 0;
  // For volume-direction agreement: count matched keywords where a higher
  // predicted volume coincided with higher actual impressions vs the median.
  const matchedPairs: { vol: number; impr: number }[] = [];

  for (const row of rows) {
    const actual = actualByKey.get(normalizeKwKey(row.keyword));
    const k: BacktestKeyword = {
      keyword: row.keyword,
      predictedVolume: row.volume,
      predictedKd: row.difficulty,
      intent: row.intent,
      impressions: actual?.impressions ?? null,
      clicks: actual?.clicks ?? null,
      ctr: actual?.ctr ?? null,
      position: actual?.position ?? null,
      status: "no-presence",
    };

    if (actual && actual.impressions > 0) {
      matched++;
      k.status = actual.position > 0 && actual.position <= 20 ? "ranking" : "impressions-only";
      if (k.status === "ranking") ranking++;
      if (row.volume != null && row.volume > 0)
        matchedPairs.push({ vol: row.volume, impr: actual.impressions });

      // CTR opportunity: ranks in the top 20 but earns below the expected
      // CTR for its position → title/meta rewrite.
      if (
        actual.position > 0 &&
        actual.position <= 20 &&
        actual.impressions >= 20 &&
        actual.ctr < expectedCtr(actual.position)
      ) {
        k.flag = "ctr-opportunity";
        ctrOpportunities++;
      }

      // Under-estimate: low/no predicted volume but real impressions.
      if (
        (row.volume == null || row.volume < 10) &&
        actual.impressions >= HIGH_IMPRESSIONS
      ) {
        k.flag = "under-estimate";
        underEstimates++;
      }
    } else {
      // Over-estimate suspect: DataforSEO promised real volume, GSC shows
      // zero presence over 90 days. (Could be not-yet-ranking, but at scale
      // it signals optimistic volumes.)
      if (row.volume != null && row.volume >= HIGH_VOLUME) {
        k.flag = "over-estimate";
        overEstimates++;
      }
    }
    keywords.push(k);
  }

  const total = rows.length;
  const coveragePct = total > 0 ? (matched / total) * 100 : 0;

  // Volume-direction agreement: split matched pairs at the median predicted
  // volume; agreement = fraction whose impressions sit on the expected side.
  let agreement = 0.5;
  if (matchedPairs.length >= 4) {
    const vols = [...matchedPairs].sort((a, b) => a.vol - b.vol);
    const medVol = vols[Math.floor(vols.length / 2)].vol;
    const imprs = [...matchedPairs].sort((a, b) => a.impr - b.impr);
    const medImpr = imprs[Math.floor(imprs.length / 2)].impr;
    const agree = matchedPairs.filter(
      (p) =>
        (p.vol >= medVol && p.impr >= medImpr) ||
        (p.vol < medVol && p.impr < medImpr),
    ).length;
    agreement = agree / matchedPairs.length;
  }

  // Confidence: coverage (40%) + direction agreement (40%) + low
  // over-estimate rate (20%).
  const overRate = total > 0 ? overEstimates / total : 0;
  const confidenceScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        (coveragePct / 100) * 40 + agreement * 40 + (1 - overRate) * 20,
      ),
    ),
  );

  // Sort: ranking first, then impressions-only, then no-presence; within,
  // by impressions desc.
  const order = { ranking: 0, "impressions-only": 1, "no-presence": 2 };
  keywords.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (b.impressions ?? 0) - (a.impressions ?? 0),
  );

  return {
    slug,
    sourceResultId: resultId,
    sourceDate: date,
    gscWindowDays: perf.days,
    totalKeywords: total,
    matched,
    ranking,
    coveragePct: Math.round(coveragePct),
    overEstimates,
    underEstimates,
    ctrOpportunities,
    confidenceScore,
    keywords,
    generatedAt: Date.now(),
  };
}

/** Markdown report for the consultant. */
export function formatBacktestMarkdown(r: KwBacktestReport): string {
  const lines: string[] = [];
  lines.push(`# Backtest — Keyword Research vs GSC real`);
  lines.push(
    `Confiança DataforSEO para este cliente: **${r.confidenceScore}/100**`,
  );
  lines.push("");
  lines.push(
    `- **Keywords avaliadas:** ${r.totalKeywords}\n- **Com presença real (impressões):** ${r.matched} (${r.coveragePct}%)\n- **A rankear (top 20):** ${r.ranking}\n- **Sobre-estimadas (volume previsto, 0 presença):** ${r.overEstimates}\n- **Sub-estimadas (long-tail com tração):** ${r.underEstimates}\n- **Oportunidades de CTR (rankeiam mas CTR baixo):** ${r.ctrOpportunities}\n- **Janela GSC:** ${r.gscWindowDays} dias`,
  );
  lines.push("");
  lines.push(
    `| Keyword | Vol previsto | KD | Pos. real | Impressões | Cliques | CTR | Estado | Flag |`,
  );
  lines.push(`|---|---:|---:|---:|---:|---:|---:|---|---|`);
  const statusLabel: Record<BacktestKeyword["status"], string> = {
    ranking: "✅ rankeia",
    "impressions-only": "👀 impressões",
    "no-presence": "—",
  };
  const flagLabel: Record<string, string> = {
    "over-estimate": "🔴 sobre-estimada",
    "under-estimate": "🟢 sub-estimada",
    "ctr-opportunity": "🟡 CTR",
  };
  for (const k of r.keywords.slice(0, 60)) {
    lines.push(
      `| ${k.keyword} | ${k.predictedVolume ?? "—"} | ${k.predictedKd ?? "—"} | ${k.position ?? "—"} | ${k.impressions ?? "—"} | ${k.clicks ?? "—"} | ${k.ctr != null ? (k.ctr * 100).toFixed(1) + "%" : "—"} | ${statusLabel[k.status]} | ${k.flag ? flagLabel[k.flag] : ""} |`,
    );
  }
  return lines.join("\n");
}

/** Compact summary injected into the NEXT research run so weighting learns
 *  from accuracy. */
export function formatBacktestForPrompt(r: KwBacktestReport): string {
  const overs = r.keywords
    .filter((k) => k.flag === "over-estimate")
    .slice(0, 8)
    .map((k) => `${k.keyword} (vol previsto ${k.predictedVolume})`);
  const unders = r.keywords
    .filter((k) => k.flag === "under-estimate")
    .slice(0, 8)
    .map((k) => `${k.keyword} (${k.impressions} impressões reais)`);
  const ctr = r.keywords
    .filter((k) => k.flag === "ctr-opportunity")
    .slice(0, 8)
    .map((k) => `${k.keyword} (pos ${k.position}, CTR ${(k.ctr! * 100).toFixed(1)}%)`);
  const lines = [
    `## Backtest da última KW Research (aprende com a precisão passada)`,
    `Confiança DataforSEO para este cliente: **${r.confidenceScore}/100** · cobertura real ${r.coveragePct}% (${r.matched}/${r.totalKeywords} keywords ganharam impressões em ${r.gscWindowDays} dias).`,
    `**Pondera o scoring com isto:**`,
    overs.length
      ? `- ⚠️ Volumes provavelmente SOBRE-estimados pelo DataforSEO (0 presença real): ${overs.join("; ")}. Trata volumes altos sem histórico com ceticismo.`
      : `- Sem sobre-estimativas claras.`,
    unders.length
      ? `- 🟢 Long-tail SUB-estimado (tração real apesar de volume baixo/nulo): ${unders.join("; ")}. Não descartes long-tail só por volume baixo.`
      : `- Sem sub-estimativas claras.`,
    ctr.length
      ? `- 🟡 Quick wins de CTR (já rankeiam, CTR abaixo do esperado): ${ctr.join("; ")}. Prioriza reescrita de title/meta.`
      : `- Sem oportunidades de CTR óbvias.`,
  ];
  return lines.join("\n");
}
