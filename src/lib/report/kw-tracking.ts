// Keyword tracking do relatório mensal (v77.82) — as regras do servidor.
//
// O consultor escolhe 15 keywords da client file e verifica a posição de
// cada uma à mão (Semrush e Search Console obrigatórios, Google opcional).
// Aqui vive o que o servidor faz com isso:
//   • `initKwTracking`     — o bloco com que um relatório NOVO nasce: a
//                            seleção do mês anterior (as que ainda estão na
//                            client file), com as posições em branco;
//   • `sanitizeKwTracking` — o que o PUT aceita do browser;
//   • `previousFrom`       — o que a keyword tinha no relatório anterior, de
//                            onde sai o Δ mês.
//
// Puro (sem KV) — quem chama passa a client file e o relatório anterior.

import type { TargetKeyword } from "@/lib/target-keywords-store";
import {
  KW_RANK_SOURCES,
  KW_TRACKING_SIZE,
  parseKwRank,
  type KeywordTrackingBlock,
  type KwRankSource,
  type MonthlyReportSnapshot,
  type TrackedKeyword,
} from "./report-types";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Quantas a seleção exige: 15, ou todas se a client file tiver menos. */
export function requiredKwCount(targets: TargetKeyword[]): number {
  return Math.min(KW_TRACKING_SIZE, targets.length);
}

/** O que a keyword tinha no relatório anterior (as três fontes + a que se
 *  mostrou), ou null se não estava na seleção desse mês. */
export function previousFrom(
  prev: MonthlyReportSnapshot | null | undefined,
  keyword: string,
): TrackedKeyword["previous"] {
  const k = norm(keyword);
  const hit = prev?.kwTracking?.keywords.find((x) => norm(x.keyword) === k);
  if (!hit) return null;
  return { semrush: hit.semrush, gsc: hit.gsc, google: hit.google, show: hit.show };
}

function fromTarget(
  t: TargetKeyword,
  prev: MonthlyReportSnapshot | null | undefined,
  show: KwRankSource,
): TrackedKeyword {
  return {
    keyword: t.keyword,
    volume: t.searchVolume ?? null,
    ...(t.premium ? { premium: true } : {}),
    semrush: null,
    gsc: null,
    google: null,
    show,
    previous: previousFrom(prev, t.keyword),
  };
}

/** O bloco com que um relatório novo nasce. A seleção herda a do mês
 *  anterior — é o que dá sentido ao Δ mês — sem as keywords que entretanto
 *  saíram da client file. As posições começam em branco: são deste mês. */
export function initKwTracking(
  targets: TargetKeyword[],
  prev: MonthlyReportSnapshot | null | undefined,
): KeywordTrackingBlock {
  const byKw = new Map(targets.map((t) => [norm(t.keyword), t] as const));
  const required = requiredKwCount(targets);
  const keywords: TrackedKeyword[] = [];
  for (const k of prev?.kwTracking?.keywords ?? []) {
    const t = byKw.get(norm(k.keyword));
    if (!t || keywords.length >= required) continue;
    keywords.push(fromTarget(t, prev, k.show));
  }
  const googleLocation = prev?.kwTracking?.googleLocation;
  return {
    keywords,
    required,
    ...(googleLocation ? { googleLocation } : {}),
    updatedAt: 0,
  };
}

/** O que o PUT aceita: só keywords da client file (até 15, sem repetidas),
 *  posições pelas regras de `parseKwRank` (o GSC com uma casa decimal). O
 *  volume vem sempre da client file e o «mês anterior» do relatório
 *  anterior — nunca do browser. */
export function sanitizeKwTracking(
  raw: unknown,
  targets: TargetKeyword[],
  prev: MonthlyReportSnapshot | null | undefined,
  by: string | undefined,
  nowMs: number,
): KeywordTrackingBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const byKw = new Map(targets.map((t) => [norm(t.keyword), t] as const));
  const required = requiredKwCount(targets);
  const keywords: TrackedKeyword[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(o.keywords) ? o.keywords : []) {
    if (keywords.length >= KW_TRACKING_SIZE) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const kw = typeof r.keyword === "string" ? norm(r.keyword) : "";
    const t = byKw.get(kw);
    if (!t || seen.has(kw)) continue;
    seen.add(kw);
    const show = KW_RANK_SOURCES.includes(r.show as KwRankSource)
      ? (r.show as KwRankSource)
      : "semrush";
    keywords.push({
      ...fromTarget(t, prev, show),
      semrush: parseKwRank(r.semrush, false),
      gsc: parseKwRank(r.gsc, true),
      google: parseKwRank(r.google, false),
    });
  }
  const loc =
    typeof o.googleLocation === "string"
      ? o.googleLocation.trim().replace(/\s+/g, " ").slice(0, 80)
      : "";
  return {
    keywords,
    required,
    ...(loc ? { googleLocation: loc } : {}),
    updatedAt: nowMs,
    ...(by ? { updatedBy: by } : {}),
  };
}
