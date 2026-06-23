// Latest KW-research backtest report per client. Persisted so the next
// research run can inject the confidence summary (closing the learning
// loop) and the consultant can re-open the last report without re-running.

import { kv } from "@vercel/kv";
import type { KwBacktestReport } from "./seo-tools/kw-backtest";

const KEY_PREFIX = "kw-backtest:";

export const kwBacktestConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function saveKwBacktest(
  slug: string,
  report: KwBacktestReport,
): Promise<void> {
  if (!kwBacktestConfigured) return;
  await kv.set(`${KEY_PREFIX}${slug}`, report);
}

export async function getKwBacktest(
  slug: string,
): Promise<KwBacktestReport | null> {
  if (!kwBacktestConfigured) return null;
  try {
    return (await kv.get<KwBacktestReport>(`${KEY_PREFIX}${slug}`)) ?? null;
  } catch {
    return null;
  }
}
