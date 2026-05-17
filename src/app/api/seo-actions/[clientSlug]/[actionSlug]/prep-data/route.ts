// Read-only access to the audit-prep KV slot. The client calls this right
// after /prep's stream ends so the Domain dashboard can render with live
// metrics while SEO Claude is still writing the analysis.

import { NextResponse } from "next/server";
import { loadAuditPrep } from "@/lib/audit-prep-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const resultId = searchParams.get("resultId");
  if (!resultId) {
    return NextResponse.json(
      { error: "resultId required" },
      { status: 400 },
    );
  }

  const prep = await loadAuditPrep(clientSlug, actionSlug, resultId);
  if (!prep) {
    return NextResponse.json({ found: false }, { status: 200 });
  }
  if (prep.status === "error") {
    return NextResponse.json(
      {
        found: true,
        status: "error",
        message: prep.message,
        stage: prep.stage,
      },
      { status: 200 },
    );
  }
  return NextResponse.json({
    found: true,
    status: "ok",
    metrics: prep.metrics,
    preparedAt: prep.preparedAt,
    inputUrl: prep.inputUrl,
  });
}
