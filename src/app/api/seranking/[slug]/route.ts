// SE Ranking project status + sync for one client.
//
// GET  → what the client page needs to render the panel (linked? how many
//        keywords tracked? which near-duplicates were collapsed?).
// POST → provision/refresh the project from the Target Keywords list.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getClientBySlug } from "@/lib/notion";
import { listTargetKeywords } from "@/lib/target-keywords-store";
import { dedupeKeywords } from "@/lib/seranking-dedupe";
import { isSeRankingConfigured } from "@/lib/seranking";
import { getSeRankingLink } from "@/lib/seranking-store";
import { syncClientToSeRanking } from "@/lib/seranking-sync";

export const runtime = "nodejs";
// A first sync creates the project, adds the engine and pushes up to 200
// keywords in 100-keyword chunks, each throttled to the documented 5 req/s.
export const maxDuration = 120;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [link, targets] = await Promise.all([
    getSeRankingLink(slug),
    listTargetKeywords(slug).catch(() => []),
  ]);
  const { kept, dropped } = dedupeKeywords(targets);

  return NextResponse.json({
    configured: isSeRankingConfigured(),
    link,
    targets: targets.length,
    // What a sync would track right now — lets the panel show the collapse
    // before the consultant commits to it.
    wouldTrack: kept.length,
    wouldDrop: dropped,
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
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

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) {
    return NextResponse.json({ error: "unknown client" }, { status: 404 });
  }

  const outcome = await syncClientToSeRanking(slug, client.title);
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 400 });
}
