// Bulk provision: sync every SEO client's Target Keywords into SE Ranking.
//
// Sequential on purpose. The API caps at 5 req/s and each client costs ~5
// calls, so firing 20 clients in parallel would trip the rate limiter and
// leave half the roster half-provisioned. One at a time, ~2s per client, is
// well inside maxDuration and each outcome is reported independently.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getSeoClients } from "@/lib/notion";
import { isSeRankingConfigured } from "@/lib/seranking";
import {
  SERANKING_EXCLUDED,
  syncClientToSeRanking,
  type SyncOutcome,
} from "@/lib/seranking-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isSeRankingConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "SERANKING_API_KEY não está definida neste deployment.",
      },
      { status: 400 },
    );
  }

  const clients = (await getSeoClients()).filter(
    (c) => !SERANKING_EXCLUDED.has(c.slug),
  );

  const results: SyncOutcome[] = [];
  for (const client of clients) {
    results.push(await syncClientToSeRanking(client.slug, client.title));
  }

  const ok = results.filter((r) => r.ok);
  return NextResponse.json({
    ok: true,
    clients: results.length,
    synced: ok.length,
    created: ok.filter((r) => r.created).length,
    tracked: ok.reduce((t, r) => t + r.tracked, 0),
    added: ok.reduce((t, r) => t + r.added, 0),
    collapsed: ok.reduce((t, r) => t + r.dropped.length, 0),
    results,
  });
}
