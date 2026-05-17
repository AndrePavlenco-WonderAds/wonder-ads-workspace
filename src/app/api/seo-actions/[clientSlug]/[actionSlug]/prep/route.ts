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
        `> 🔧 Phase 1 / 3 — gathering site data for \`${new URL(targetUrl).origin}\`\n`,
      );

      // Two failure modes we want to capture: (1) the orchestrator throws
      // (rare — every step is wrapped in `timed()`), (2) saving to KV throws.
      // Either way, persist an `{ status: "error" }` record so /run can
      // surface a useful message instead of "No prep data found".
      let stage: "init" | "runSiteAudit" | "save" = "init";
      try {
        stage = "runSiteAudit";
        // Phase 1 skips DataforSEO — that runs in /prep-dataforseo so each
        // phase fits comfortably under Vercel's 60s function budget. The
        // DataforSEO call alone with historical_serp_mode + limit 1000 can
        // take 20-40s on big EN-language sites (e.g. IHN).
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
          { depth, skipDataforSeo: true, skipPsi: true },
        );

        stage = "save";
        await saveAuditPrep(clientSlug, actionSlug, resultId, {
          status: "ok",
          factPack: pack.markdown,
          metrics: null, // populated by /prep-dataforseo
          preparedAt: Date.now(),
          inputUrl: targetUrl,
        });

        send(
          `\n> ✅ **Phase 1 complete** — site data saved. Running PageSpeed + Domain intelligence…\n`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send(
          `\n> ❌ Phase 1 crashed at \`${stage}\`: ${message.slice(0, 240)}\n`,
        );
        // Best-effort: record the failure so /run shows a real message instead
        // of a generic "no prep" 404. Wrapped in its own try/catch because if
        // saving the error itself fails (e.g. KV down) we don't have many
        // options left.
        try {
          await saveAuditPrep(clientSlug, actionSlug, resultId, {
            status: "error",
            message: message.slice(0, 800),
            stage,
            preparedAt: Date.now(),
            inputUrl: targetUrl,
          });
        } catch (saveErr) {
          console.error("audit-prep error record save failed:", saveErr);
        }
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
