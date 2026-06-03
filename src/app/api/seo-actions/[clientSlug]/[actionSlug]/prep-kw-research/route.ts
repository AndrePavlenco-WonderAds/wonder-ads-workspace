// Phase 1 of the split Keyword Research flow: pull DataforSEO Labs data
// (domain ranked, suggestions, ideas, competitor footprints), persist the
// KwResearchPack to KV, and stream tool-progress events back to the
// client. Phase 2 (/run-kw-research) loads the pack and streams Claude.
//
// The split predates Vercel Pro — originally needed to keep each phase
// inside the 60s ceiling. With Pro's 300s we no longer need it for
// timeout reasons, but the per-phase progress UX is worth keeping.

import { NextResponse } from "next/server";
import { findAction } from "@/lib/seo-pillars";
import { getClientBySlug } from "@/lib/notion";
import { getClientWebsite } from "@/lib/client-meta";
import { getOnboardingForSlug } from "@/lib/onboarding-store";
import { runKeywordResearch } from "@/lib/seo-tools/keyword-research";
import { saveKwResearchPrep } from "@/lib/kw-research-prep-store";
import { findLocationTarget } from "@/lib/location-targets";

// Vercel Pro — 300s. DataforSEO Labs + 5 competitor footprint pulls
// can chain past 60s when the onboarding form names many competitors.
export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;

  const entry = findAction(actionSlug);
  if (!entry || entry.action.slug !== "keyword-research") {
    return NextResponse.json(
      { error: "Phase split is only available for keyword-research." },
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
    /* empty body fine */
  }
  if (!resultId) {
    return NextResponse.json(
      { error: "resultId required for split prep." },
      { status: 400 },
    );
  }

  // Resolve client name (used as a brand-token signal when picking
  // non-branded expansion seeds + as a sensible default seed).
  let clientName = clientSlug;
  try {
    const c = await getClientBySlug(clientSlug);
    if (c?.title) clientName = c.title;
  } catch {
    /* fall back to slug */
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      send(`> 🔧 Phase 1 / 2 — pulling keyword data for **${clientName}**\n`);

      try {
        const useOnboardingFlag =
          (inputs.useOnboarding ?? "true").toLowerCase() !== "false";
        let seedTopic = (inputs.seedTopic ?? "").trim();
        const onboarding = useOnboardingFlag
          ? await getOnboardingForSlug(clientSlug)
          : null;

        if (!seedTopic && onboarding?.suggestedSeed) {
          seedTopic = onboarding.suggestedSeed;
          send(
            `> ℹ️ Seed auto-filled from onboarding form: \`${seedTopic}\`\n`,
          );
        } else if (!seedTopic && onboarding) {
          // Empty seed + form present: defer to the domain footprint as
          // the foundation rather than a synthetic "X services" seed
          // that returns nothing.
          seedTopic = "";
          send(
            `> ℹ️ No seed topic — research will pivot off the domain's full keyword footprint + onboarding form.\n`,
          );
        }

        if (onboarding) {
          const compNote =
            onboarding.competitors && onboarding.competitors.length > 0
              ? ` · ${onboarding.competitors.length} competitor(s) detected`
              : "";
          send(
            `> ✓ **Onboarding form** \`${onboarding.name}\`${compNote}\n`,
          );
        } else if (useOnboardingFlag) {
          send(
            `> ⚠️ No onboarding form on file — relying on domain footprint + seed only.\n`,
          );
        }

        const website = getClientWebsite(clientSlug);
        const target = website
          ? new URL(
              /^https?:\/\//i.test(website) ? website : `https://${website}`,
            ).hostname.replace(/^www\./, "")
          : undefined;

        const locationOverride = findLocationTarget(inputs.geo) ?? null;
        if (locationOverride) {
          send(
            `> 🌍 Geo: **${locationOverride.label}** (${locationOverride.languageCode}, code ${locationOverride.locationCode})${locationOverride.localModifier ? ` — local modifier: **${locationOverride.localModifier}**` : ""}\n`,
          );
        }

        if (!seedTopic && !target) {
          send(
            `> ❌ Nothing to anchor on — need either a seed topic OR a client website on file. Add either and retry.\n`,
          );
          controller.close();
          return;
        }

        const startedAt = Date.now();
        const pack = await runKeywordResearch(seedTopic, clientSlug, {
          intent: (inputs.intent?.toLowerCase().replace(/\s+/g, "") ?? "all") as
            | "all"
            | "informational"
            | "commercial"
            | "transactional"
            | "navigational",
          target,
          perEndpointLimit: 300,
          competitorDomains: onboarding?.competitors ?? [],
          locationOverride: locationOverride ?? undefined,
          clientName,
          extraSeedText: onboarding?.extractedText?.slice(0, 4000) ?? "",
        });
        const ms = Date.now() - startedAt;

        if (!pack) {
          send(
            `> ❌ DataforSEO not configured — set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD in Vercel env.\n`,
          );
          controller.close();
          return;
        }

        if (pack.fallbackInfo) {
          send(
            `> ⚠️ **Geo fallback:** \`${pack.fallbackInfo.triedLabel}\` returned no data → re-queried with \`${pack.fallbackInfo.fellBackTo}\`.\n`,
          );
        }

        const totalKeywords =
          pack.suggestions.length +
          pack.ideas.length +
          pack.domainExisting.length +
          pack.competitors.reduce((s, c) => s + c.keywords.length, 0);

        send(
          `> ✓ **DataforSEO** — ${pack.suggestions.length} suggestions · ${pack.ideas.length} ideas · ${pack.domainExisting.length} already-ranking · ${pack.competitors.length} competitor footprint(s) → **${totalKeywords} keywords total** (${ms} ms)\n`,
        );
        // Verbose per-call diagnostics — surfaces every seed we tried and
        // what each endpoint returned. Critical for debugging "thin
        // universe" cases (which seed worked, which didn't, status codes).
        if (pack.diagnostics && pack.diagnostics.length > 0) {
          send(`> **Per-seed call log:**\n`);
          for (const d of pack.diagnostics) {
            const status = d.apiStatus != null ? ` [status ${d.apiStatus}]` : "";
            if (d.error) {
              send(
                `>   ❌ \`${d.endpoint}\` seed=\`${d.seed.slice(0, 50)}\` → error: ${d.error.slice(0, 160)}${status}\n`,
              );
            } else {
              send(
                `>   ${d.count > 0 ? "✓" : "○"} \`${d.endpoint}\` seed=\`${d.seed.slice(0, 50)}\` → ${d.count} keywords${status}\n`,
              );
            }
          }
        }
        // Detect smoke-test result. If even the canonical "dentista" probe
        // returned 0, the issue is DataforSEO subscription / connectivity,
        // not our seed strategy.
        const smoke = pack.diagnostics?.find((d) => d.endpoint === "smoke-test");
        if (smoke && smoke.count === 0) {
          send(
            `> 🚨 **DataforSEO connectivity / subscription issue suspected.** Even a canonical generic seed (\`${smoke.seed}\`) returned 0 keywords from \`keyword_suggestions/live\`. Run \`/api/diagnostics/dataforseo-test?target=${target ?? "whiteclinic.pt"}\` from the browser to verify the subscription tier covers Labs keyword endpoints.\n`,
          );
        }
        if (totalKeywords < 30 && !smoke) {
          send(
            `> ⚠️ **Thin universe (${totalKeywords} keywords).** Likely causes: (a) the domain has very few rankings in this geo, (b) the seed topic is too narrow/branded, or (c) DataforSEO's data is sparse for this market. Consider broadening the geo (try the national-level target) or providing a more generic seed topic.\n`,
          );
        }
        for (const e of pack.errors) {
          send(`> ⚠️ Partial: ${e.source} — ${e.message.slice(0, 200)}\n`);
        }

        // Persist the structured pack for Phase 2 + /save.
        await saveKwResearchPrep(clientSlug, actionSlug, resultId, pack);
        send(
          `\n> ✅ **Phase 1 complete** — keyword data saved. Handing off to SEO Claude…\n`,
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
