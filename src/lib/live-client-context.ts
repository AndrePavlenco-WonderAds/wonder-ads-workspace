// Single source of truth for the live client tables that every SEO
// action should consult before generating output. The principle (laid
// down 2026-06-11): actions read what the consultant tables currently
// say, never what the app generated last time.
//
// What "live" means here:
//   - Onboarding form  → getOnboardingForSlug(slug)        — the
//     consultant uploads this once at intake and updates as the client
//     pivots. It names services to push, services to avoid, brand
//     voice, audience, competitors.
//   - Target Keywords  → listTargetKeywords(slug)          — the live
//     editorial wish-list (manual adds, pushes from Keyword Research).
//     Each row carries volume / KD / intent.
//   - Geo / locale     → getClientGeo(slug)                — drives
//     DataforSEO queries AND copy language hints.
//
// Brief (Do's / Don'ts / Notes) is NOT in this helper because the
// system prompt builder (buildSeoClaudeSystemPrompt) already injects
// it for every action. Adding it here would duplicate.
//
// `formatLiveClientContextBlock` takes the loaded context and returns a
// markdown block ready to drop into the user-prompt factPack — or null
// when there's nothing useful to share (empty tables) so we don't bloat
// the prompt with empty headers.

import {
  getOnboardingForSlug,
  type OnboardingDoc,
} from "./onboarding-store";
import {
  listTargetKeywords,
  type TargetKeyword,
} from "./target-keywords-store";
import { getClientGeo, type ClientGeo } from "./client-geo";

export type LiveClientContext = {
  onboarding: OnboardingDoc | null;
  targetKeywords: TargetKeyword[];
  geo: ClientGeo;
};

/** Load every live client table the SEO actions consult. Brief is NOT
 *  loaded here — it's already injected via the system prompt builder. */
export async function getLiveClientContext(
  slug: string,
): Promise<LiveClientContext> {
  const [onboarding, targetKeywords] = await Promise.all([
    getOnboardingForSlug(slug),
    listTargetKeywords(slug),
  ]);
  const geo = getClientGeo(slug);
  return { onboarding, targetKeywords, geo };
}

export type FormatLiveContextOptions = {
  /** Skip the Onboarding form section. Use for actions whose own branch
   *  already attaches the PDF natively (write-blog-article) — otherwise
   *  Claude sees the form text twice. */
  skipOnboarding?: boolean;
  /** Skip the Target Keywords section. Use for actions whose JOB is to
   *  produce target keywords (keyword-research). */
  skipTargetKeywords?: boolean;
  /** Skip the Geo line. Rarely needed — geo is one line. */
  skipGeo?: boolean;
  /** How many target keywords to render in the block. Default 25 — keeps
   *  the prompt focused on the strongest commercial keywords without
   *  flooding Claude with the long tail. */
  targetKeywordsCap?: number;
  /** How much of the onboarding extracted text to inline. Default 4000
   *  chars — Anthropic SDK lets us go higher but most actions don't
   *  need it; blog-writer-style actions that want full text already
   *  attach the PDF natively. */
  onboardingExcerptChars?: number;
};

const DEFAULT_TK_CAP = 25;
const DEFAULT_ONBOARDING_CHARS = 4000;

/** Format the live client context as a markdown block for the factPack.
 *  Returns null when there's nothing useful (no onboarding + no target
 *  keywords + geo skipped) so callers can avoid an empty section. */
export function formatLiveClientContextBlock(
  ctx: LiveClientContext,
  opts: FormatLiveContextOptions = {},
): string | null {
  const tkCap = opts.targetKeywordsCap ?? DEFAULT_TK_CAP;
  const obCap = opts.onboardingExcerptChars ?? DEFAULT_ONBOARDING_CHARS;
  const pieces: string[] = [];

  if (!opts.skipGeo) {
    pieces.push(formatGeoLine(ctx.geo));
  }

  if (!opts.skipTargetKeywords && ctx.targetKeywords.length > 0) {
    pieces.push(formatTargetKeywords(ctx.targetKeywords, tkCap));
  }

  if (!opts.skipOnboarding && ctx.onboarding) {
    const block = formatOnboarding(ctx.onboarding, obCap);
    if (block) pieces.push(block);
  }

  if (pieces.length === 0) return null;

  // Lead with a short header so Claude understands this block is
  // authoritative and live — not historical and not the consultant's
  // free-text inputs.
  return [
    "## Live client context (pulled fresh from the tables — these reflect what the consultant has on file RIGHT NOW)",
    "",
    pieces.join("\n\n"),
  ].join("\n");
}

function formatGeoLine(geo: ClientGeo): string {
  return `**Market / language:** ${geo.countryLabel} (${geo.languageCode}, location_code ${geo.locationCode}). All copy, keywords, and examples must be in this market's language and idiom.`;
}

function formatTargetKeywords(items: TargetKeyword[], cap: number): string {
  // Strongest commercial value first — sort by volume desc, missing
  // volume to the back so empties don't hide enriched rows.
  const sorted = [...items].sort(
    (a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1),
  );
  const top = sorted.slice(0, cap);
  const lines = top.map((k) => {
    const parts: string[] = [`- **${k.keyword}**`];
    const meta: string[] = [];
    if (k.searchVolume != null) meta.push(`${k.searchVolume}/mo`);
    if (k.difficulty != null) meta.push(`KD ${k.difficulty}`);
    if (k.intent) meta.push(`intent: ${k.intent}`);
    if (meta.length > 0) parts.push(`(${meta.join(" · ")})`);
    return parts.join(" ");
  });
  const trailer =
    items.length > cap
      ? `\n_…and ${items.length - cap} more (truncated; sorted by volume desc — top ${cap} shown)._`
      : "";
  return [
    `### Target Keywords table — ${items.length} keyword${items.length === 1 ? "" : "s"} the consultant has committed to ranking for`,
    "These are the LIVE editorial targets. Anchor primary keywords, anchor text, headings, alt text, schema entity hints, and content angles to this list. If a keyword you'd otherwise use isn't on this list, prefer one that IS on the list when there's a sensible match.",
    "",
    lines.join("\n"),
    trailer,
  ].join("\n");
}

function formatOnboarding(
  onboarding: OnboardingDoc,
  cap: number,
): string | null {
  const competitors =
    onboarding.competitors && onboarding.competitors.length > 0
      ? onboarding.competitors
      : null;
  const text = (onboarding.extractedText ?? "").trim();
  if (!text && !competitors) {
    // Nothing useful to render even though a file exists.
    return null;
  }

  const competitorLine = competitors
    ? `- **Competitors named in the form (NEVER link to or recommend these):** ${competitors.join(", ")}`
    : "";

  const excerpt = text
    ? [
        "",
        "### Onboarding form excerpt (what the client said at intake)",
        "```",
        text.slice(0, cap) +
          (text.length > cap ? "\n…[truncated — full file on the client page]" : ""),
        "```",
      ].join("\n")
    : "";

  const header = `### Onboarding form on file — \`${onboarding.name}\`${competitors ? ` · ${competitors.length} competitor(s) named` : ""}`;
  const intro =
    "The client filled this out at intake. It names services to push, services to avoid, audience, brand voice, and competitors. Quote short excerpts where useful. Do NOT mention any service the form doesn't list. Do NOT link to or recommend any competitor named here.";

  return [header, intro, competitorLine, excerpt]
    .filter((s) => s !== "")
    .join("\n");
}

/** True if the onboarding has content Claude can actually consume — i.e.
 *  the form was extracted (has text) OR the form named competitors.
 *  Used both by `formatOnboarding` (to suppress empty sections) and the
 *  progress summary (so the two stay honest with each other). */
function onboardingHasUsableContent(ob: OnboardingDoc | null): boolean {
  if (!ob) return false;
  const text = (ob.extractedText ?? "").trim();
  const competitors = ob.competitors && ob.competitors.length > 0;
  return text.length > 0 || Boolean(competitors);
}

/** Short one-line progress summary for the streamed `> ✓ …` log so the
 *  consultant sees that live context was loaded — without dumping the
 *  full block into the visible stream. */
export function summariseLiveContextForProgress(
  ctx: LiveClientContext,
  opts: FormatLiveContextOptions = {},
): string {
  const parts: string[] = [];
  if (!opts.skipTargetKeywords && ctx.targetKeywords.length > 0) {
    const enriched = ctx.targetKeywords.filter(
      (k) => k.searchVolume != null || k.difficulty != null,
    ).length;
    parts.push(
      `${ctx.targetKeywords.length} target keyword${ctx.targetKeywords.length === 1 ? "" : "s"} (${enriched} enriched)`,
    );
  }
  if (!opts.skipOnboarding) {
    if (onboardingHasUsableContent(ctx.onboarding)) {
      parts.push(`onboarding form on file (${ctx.onboarding!.name})`);
    } else if (ctx.onboarding) {
      // Form uploaded but extraction is empty AND no competitors named
      // — Claude won't see any content from it. Be honest with the
      // consultant so they can re-upload / fix the extraction.
      parts.push(
        `onboarding form on file but extraction empty — Claude can't read its contents (re-upload to fix)`,
      );
    }
  }
  if (!opts.skipGeo) {
    parts.push(`${ctx.geo.countryLabel} / ${ctx.geo.languageCode}`);
  }
  return parts.length > 0
    ? `Live context: ${parts.join(" · ")}`
    : "Live context: no onboarding or target keywords on file yet — running on brief + inputs only.";
}
