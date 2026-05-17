// Phase 3 of the SEO Audit (and a general "finalize" endpoint for any
// streamed action): persist the analysis to KV in a separate request.
//
// Why this exists: /run streams Claude (15-50s) and the appendHistory call
// that used to follow the stream was getting killed by Vercel's 60s function
// timeout before completing — meaning nothing ever made it into KV. By
// splitting the save into its own endpoint, the KV write (~100ms) is no
// longer racing the Claude stream against the timeout.

import { NextResponse } from "next/server";
import { findAction } from "@/lib/seo-pillars";
import { appendHistory } from "@/lib/action-history";
import { loadAuditPrep, clearAuditPrep } from "@/lib/audit-prep-store";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL_ID = "claude-sonnet-4-6";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;

  const entry = findAction(actionSlug);
  if (!entry) {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }

  let body: {
    resultId?: string;
    inputs?: Record<string, string>;
    output?: string;
    model?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resultId = body.resultId;
  const inputs = body.inputs ?? {};
  const output = (body.output ?? "").trim();
  const model = body.model ?? MODEL_ID;

  if (!resultId) {
    return NextResponse.json({ error: "resultId required" }, { status: 400 });
  }
  if (!output) {
    return NextResponse.json(
      { error: "output required (empty after trim)" },
      { status: 400 },
    );
  }

  // For seo-audit, pull the saved prep so we can persist its metrics +
  // free the slot. For other actions, prep won't exist and that's fine.
  let metrics = undefined;
  if (actionSlug === "seo-audit") {
    const prep = await loadAuditPrep(clientSlug, actionSlug, resultId);
    if (prep && prep.status === "ok") {
      metrics = prep.metrics ?? undefined;
    }
  }

  try {
    const saved = await appendHistory({
      id: resultId,
      clientSlug,
      actionSlug,
      inputs,
      output,
      model,
      ...(metrics ? { metrics } : {}),
    });
    if (actionSlug === "seo-audit") {
      await clearAuditPrep(clientSlug, actionSlug, resultId);
    }
    return NextResponse.json({
      ok: true,
      id: saved.id,
      metrics: saved.metrics ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Persist failed: ${message}` },
      { status: 500 },
    );
  }
}
