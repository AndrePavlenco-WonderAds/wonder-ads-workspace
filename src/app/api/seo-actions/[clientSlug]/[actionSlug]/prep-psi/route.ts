// Phase 2 of the split SEO Audit: PageSpeed Insights (mobile + desktop).
// Split apart from DataforSEO because both can independently take 30-50s
// on heavy sites and combining them was blowing Vercel's 60s function
// budget for big EN-language clients like IHN.

import { NextResponse } from "next/server";
import { findAction } from "@/lib/seo-pillars";
import { runPsiPhase } from "@/lib/seo-tools/site-audit";
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
      { error: "Phase 1 prep not found. Run /prep first." },
      { status: 404 },
    );
  }
  if (prep.status === "error") {
    return NextResponse.json(
      { error: `Phase 1 failed (${prep.stage}): ${prep.message}.` },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      send(
        `\n> 🔧 Phase 2 / 4 — PageSpeed Insights for \`${new URL(prep.inputUrl).origin}\`\n`,
      );

      try {
        const { markdown } = await runPsiPhase(prep.inputUrl, (e) => {
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
        });

        const combined = markdown
          ? `${prep.factPack}\n\n${markdown}`
          : prep.factPack;

        await saveAuditPrep(clientSlug, actionSlug, resultId, {
          status: "ok",
          factPack: combined,
          metrics: prep.metrics,
          preparedAt: Date.now(),
          inputUrl: prep.inputUrl,
        });

        send(
          `\n> ✅ **Phase 2 complete** — PSI saved. Fetching domain intelligence…\n`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send(`\n> ❌ Phase 2 crashed: ${message.slice(0, 240)}\n`);
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
