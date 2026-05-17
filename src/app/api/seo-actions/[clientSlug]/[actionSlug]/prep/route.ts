// Phase 1 of the split SEO Audit: run the tools, stream progress, persist
// the fact pack to KV. Returns text/plain stream of "> ✓ …" blockquote
// lines (same protocol as the single-call route) so the client's existing
// progress parser keeps working. The /run endpoint picks up from KV.

import { NextResponse } from "next/server";
import { findAction } from "@/lib/seo-pillars";
import {
  runSiteAudit,
  type SiteAuditDepth,
} from "@/lib/seo-tools/site-audit";
import { saveAuditPrep } from "@/lib/audit-prep-store";

export const maxDuration = 60;
export const runtime = "nodejs";

function normaliseUrl(input: string | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

function parseDepth(raw: string | undefined): SiteAuditDepth {
  switch ((raw ?? "").toLowerCase()) {
    case "quick":
      return "Quick";
    case "deep":
      return "Deep";
    case "all":
      return "All";
    case "standard":
    default:
      return "Standard";
  }
}

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

  let inputs: Record<string, string> = {};
  let resultId: string | undefined;
  try {
    const body = (await req.json()) as {
      inputs?: Record<string, string>;
      resultId?: string;
    };
    if (body.inputs && typeof body.inputs === "object") inputs = body.inputs;
    if (typeof body.resultId === "string") resultId = body.resultId;
  } catch {
    /* empty body is fine */
  }

  if (!resultId) {
    return NextResponse.json(
      { error: "resultId required for split prep." },
      { status: 400 },
    );
  }

  const toolUrlField = entry.action.toolUrlField ?? "pageUrl";
  const targetUrl = normaliseUrl(inputs[toolUrlField]);
  if (!targetUrl) {
    return NextResponse.json(
      { error: `URL required in inputs.${toolUrlField}` },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const depth = parseDepth(inputs.depth);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      send(
        `> 🔧 Phase 1 / 2 — gathering live data for \`${new URL(targetUrl).origin}\`\n`,
      );

      try {
        const pack = await runSiteAudit(
          targetUrl,
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
          { depth },
        );

        // Persist the fact pack so /run can pick it up. Must complete BEFORE
        // controller.close() so the client sees the stream end as confirmation
        // the data is saved.
        await saveAuditPrep(clientSlug, actionSlug, resultId, {
          factPack: pack.markdown,
          metrics: pack.metrics,
          preparedAt: Date.now(),
          inputUrl: targetUrl,
        });

        send(
          `\n> ✅ **Phase 1 complete** — fact pack saved. Starting analysis…\n`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send(`\n> ❌ Phase 1 crashed: ${message.slice(0, 240)}\n`);
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
