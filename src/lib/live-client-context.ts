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
//   - Client Files     → getFilesForSlug(slug)             — (v74.28)
//     the per-client Files library on the SEO/ADS dashboards. PDFs,
//     DOCX, XLSX, CSV, TXT, MD are extracted to plain text and inlined;
//     images, videos, and links are listed by URL + name so Claude
//     knows the asset exists and the consultant can be told to look
//     at it.
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
import { getFilesForSlug } from "./files-storage";
import { isExtractableKind, type ClientFile } from "./client-files";
import { extractFromUrl } from "./pdf-extract";

export type LiveClientFile = {
  /** The raw library record — id, kind, name, url, addedAt. */
  file: ClientFile;
  /** Plain-text extraction for PDF/text-style files. null for
   *  images/videos/links (where we only inline name + URL) or when
   *  extraction failed. */
  extractedText: string | null;
  /** Chars in extractedText before any per-file truncation. Lets the
   *  formatter show "extracted 18,981 chars (truncated to 4,000)"
   *  when the budget kicks in. */
  extractedChars: number;
};

export type LiveClientContext = {
  onboarding: OnboardingDoc | null;
  targetKeywords: TargetKeyword[];
  files: LiveClientFile[];
  geo: ClientGeo;
};

/** Cap how many client files we try to extract text from per request.
 *  Beyond this, files are listed by name/URL only so Claude knows they
 *  exist without us racing the action timeout fetching dozens of PDFs. */
const MAX_EXTRACT_FILES = 6;
/** Per-file extraction budget (chars). PDFs commonly extract 8-20k
 *  chars; we slice to this to keep any one file from dominating. */
const PER_FILE_EXTRACT_CHARS = 6000;

/** Load + extract the client files library for a slug. Newest-first,
 *  best-effort: extraction happens in parallel for the first
 *  MAX_EXTRACT_FILES text-style files (PDF/TXT/MD), and a failed fetch
 *  or extraction on one file never breaks the load — the file stays in
 *  the list with `extractedText: null` so Claude can still reference
 *  it by name + URL. Exposed standalone so the specialised action
 *  runners (meta-generate, gmb-generate) can pick up client files
 *  without re-loading brief/onboarding/target-keywords. */
export async function loadClientFilesWithExtraction(
  slug: string,
): Promise<LiveClientFile[]> {
  const rawFiles = await getFilesForSlug(slug);
  const sorted = [...rawFiles].sort((a, b) => b.addedAt - a.addedAt);
  let extractBudget = MAX_EXTRACT_FILES;
  return Promise.all(
    sorted.map(async (f) => {
      if (!isExtractableKind(f.kind) || extractBudget <= 0) {
        return { file: f, extractedText: null, extractedChars: 0 };
      }
      extractBudget--;
      try {
        // contentType isn't stored on ClientFile — extractFromUrl
        // sniffs the URL extension when the type doesn't match, so
        // an empty string is the safe pass-through.
        const result = await extractFromUrl(f.url, "");
        const text = (result.text ?? "").trim();
        return {
          file: f,
          extractedText: text || null,
          extractedChars: text.length,
        };
      } catch (err) {
        console.warn(
          `[live-client-context] extraction failed for ${f.name}:`,
          err instanceof Error ? err.message : String(err),
        );
        return { file: f, extractedText: null, extractedChars: 0 };
      }
    }),
  );
}

/** Load every live client table the SEO actions consult. Brief is NOT
 *  loaded here — it's already injected via the system prompt builder. */
export async function getLiveClientContext(
  slug: string,
): Promise<LiveClientContext> {
  const [onboarding, targetKeywords, files] = await Promise.all([
    getOnboardingForSlug(slug),
    listTargetKeywords(slug),
    loadClientFilesWithExtraction(slug),
  ]);
  const geo = getClientGeo(slug);
  return { onboarding, targetKeywords, files, geo };
}

export type FormatLiveContextOptions = {
  /** Skip the Onboarding form section. Use for actions whose own branch
   *  already attaches the PDF natively (write-blog-article) — otherwise
   *  Claude sees the form text twice. */
  skipOnboarding?: boolean;
  /** Skip the Target Keywords section. Use for actions whose JOB is to
   *  produce target keywords (keyword-research). */
  skipTargetKeywords?: boolean;
  /** Skip the Client Files library section. Use for actions whose
   *  own branch already loads the files natively (gmb-posts pools
   *  images from the library directly). */
  skipClientFiles?: boolean;
  /** Skip the Geo line. Rarely needed — geo is one line. */
  skipGeo?: boolean;
  /** How many target keywords to render in the block. Default 25 — keeps
   *  the prompt focused on the strongest commercial keywords without
   *  flooding Claude with the long tail. */
  targetKeywordsCap?: number;
  /** How much of the onboarding extracted text to inline. Default
   *  12000 chars — enough to fit the entire form for ~10/15 clients
   *  (the average extracted form is ~10k chars after the v74.26
   *  extraction backfill) and the meaty middle of the larger ones.
   *  Costs ~3k tokens per call, which is well inside budget. Was 4000
   *  before v74.26 — too conservative once extraction actually worked.
   *  Blog-writer-style actions that want the full PDF still attach it
   *  natively for layout fidelity. */
  onboardingExcerptChars?: number;
  /** Per-file cap on inlined client-file extracted text. Default
   *  matches PER_FILE_EXTRACT_CHARS so the formatter doesn't fight
   *  the loader. */
  perFileExtractChars?: number;
};

const DEFAULT_TK_CAP = 25;
const DEFAULT_ONBOARDING_CHARS = 12000;

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

  if (!opts.skipClientFiles && ctx.files.length > 0) {
    const fileCap = opts.perFileExtractChars ?? PER_FILE_EXTRACT_CHARS;
    const block = formatClientFiles(ctx.files, fileCap);
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

/** Format the Client Files library section. We list every file (so
 *  Claude knows the asset exists and the consultant can be told to
 *  open it) and inline extracted text for the ones we successfully
 *  pulled content from (PDFs, TXT, MD). Images, videos, links, and
 *  files where extraction failed render as a one-liner with kind +
 *  name + URL only. Exported so specialised runners (meta-generate)
 *  can drop the same block into their own custom prompt builders. */
export function formatClientFilesBlock(
  files: LiveClientFile[],
  perFileCap: number = PER_FILE_EXTRACT_CHARS,
): string {
  return formatClientFiles(files, perFileCap);
}

function formatClientFiles(files: LiveClientFile[], perFileCap: number): string {
  // Group by kind so the prompt reads cleanly: extracted content first
  // (most signal), then the asset list (less signal).
  const withText = files.filter(
    (f) => f.extractedText !== null && f.extractedText.length > 0,
  );
  const assets = files.filter((f) => f.extractedText === null);

  const header = `### Client Files library — ${files.length} file${files.length === 1 ? "" : "s"} uploaded by the consultant`;
  const intro =
    "Files the consultant attached to this client on the dashboard. Read these as live primary sources — brand guidelines, brief decks, contract addenda, audit notes, screenshots of past work, anything they've made available. Quote short excerpts where useful and refer to images/videos by filename when the deliverable should reflect them.";

  const sections: string[] = [];

  if (withText.length > 0) {
    const blocks = withText.map((f) => {
      const raw = f.extractedText ?? "";
      const sliced = raw.slice(0, perFileCap);
      const truncatedNote =
        raw.length > perFileCap
          ? `\n…[truncated — ${f.extractedChars.toLocaleString()} chars total, ${perFileCap.toLocaleString()} shown]`
          : "";
      return [
        `#### \`${f.file.name}\` (${f.file.kind})`,
        `URL: ${f.file.url}`,
        "```",
        sliced + truncatedNote,
        "```",
      ].join("\n");
    });
    sections.push(blocks.join("\n\n"));
  }

  if (assets.length > 0) {
    const lines = assets.map(
      (f) =>
        `- **${f.file.name}** [${f.file.kind}] — ${f.file.url}`,
    );
    sections.push(
      [
        `#### Other assets (no inline text — Claude should reference these by name only)`,
        lines.join("\n"),
      ].join("\n"),
    );
  }

  if (sections.length === 0) return "";
  return [header, intro, "", sections.join("\n\n")].join("\n");
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
  if (!opts.skipClientFiles && ctx.files.length > 0) {
    const extractedCount = ctx.files.filter(
      (f) => f.extractedText !== null,
    ).length;
    const byKind = new Map<string, number>();
    for (const f of ctx.files) {
      byKind.set(f.file.kind, (byKind.get(f.file.kind) ?? 0) + 1);
    }
    const breakdown = Array.from(byKind.entries())
      .map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`)
      .join(", ");
    parts.push(
      `${ctx.files.length} client file${ctx.files.length === 1 ? "" : "s"} (${breakdown}; ${extractedCount} with extracted text)`,
    );
  }
  if (!opts.skipGeo) {
    parts.push(`${ctx.geo.countryLabel} / ${ctx.geo.languageCode}`);
  }
  return parts.length > 0
    ? `Live context: ${parts.join(" · ")}`
    : "Live context: no onboarding, target keywords, or client files on file yet — running on brief + inputs only.";
}
