// Phase 2 of the split SEO Audit: runs ONLY the DataforSEO Labs + LLM
// Mentions calls. Reads the prep record saved by /prep (Phase 1), runs
// DataforSEO with historical_serp_mode + limit 1000, appends its fact-pack
// section + metrics to the prep record. Each phase fits cleanly under
// Vercel's 60s function budget.

import { NextResponse } from "next/server";
import { findAction } from "@/lib/seo-pillars";
import { runDataforSeoPhase } from "@/lib/seo-tools/site-audit";
import { loadAuditPrep, saveAuditPrep } from "@/lib/audit-prep-store";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;

  const entry = findAction(actionSlug);
  if (!entry || entry.action.slug !== "seo-audit") {
    return NextResponse.json(
      { error: "Phase split is only available for seo-audit." },
      { status: 400 },
    );
  }

  let resultId: string | undefined;
  try {
    const body = (await req.json()) as { resultId?: string };
    if (typeof body.resultId === "string") resultId = body.resultId;
  } catch {
    /* empty body */
  }
  if (!resultId) {
    return NextResponse.json(
      { error: "resultId required for split prep." },
      { status: 400 },
    );
  }

  const prep = await loadAuditPrep(clientSlug, actionSlug, resultId);
  if (!prep) {
    return NextResponse.json(
      {
        error:
          "Phase 1 prep not found. Run /prep first (it should have run before this).",
      },
      { status: 404 },
    );
  }
  if (prep.status === "error") {
    return NextResponse.json(
      {
        error: `Phase 1 failed (${prep.stage}): ${prep.message}. Re-run from scratch.`,
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      send(
        `\n> 🔧 Phase 2 / 3 — domain intelligence for \`${new URL(prep.inputUrl).origin}\`\n`,
      );

      try {
        const { markdown, metrics } = await runDataforSeoPhase(
          prep.inputUrl,
          clientSlug,
          (e) => {
            if (e.type === "start") {
              send(`> ⏳ **${e.label}**…\n`);
            } else if (e.type === "done") {
              send(`> ✓ **${e.label}** — ${e.summary} (${e.ms} ms)\n`);
            } else if (e.type === "error") {
              send(
                `> ❌ **${e.label}** failed: ${e.message.slice(0, 240)} (${e.ms} ms)\n`,
              );
            } else {
              send(`> ${e.message}\n`);
            }
          },
        );

        const combinedFactPack = markdown
          ? `${prep.factPack}\n\n${markdown}`
          : prep.factPack;

        await saveAuditPrep(clientSlug, actionSlug, resultId, {
          status: "ok",
          factPack: combinedFactPack,
          metrics,
          preparedAt: Date.now(),
          inputUrl: prep.inputUrl,
        });

        send(
          `\n> ✅ **Phase 2 complete** — fact pack ready. Starting analysis…\n`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send(`\n> ❌ Phase 2 crashed: ${message.slice(0, 240)}\n`);
        // Don't overwrite prep on error — Phase 1 data is still valid.
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
