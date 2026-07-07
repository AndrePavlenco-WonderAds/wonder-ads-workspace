// Generate a fresh 12-week SEO roadmap for a client.
//
// Uses Anthropic via the AI SDK's `generateObject` with a Zod schema so
// the output is *guaranteed* valid JSON matching our `Roadmap` shape —
// no more loose parsing or "Claude returned prose around the JSON"
// failure modes. Grounds in the same context as the `client-roadmap`
// markdown action: brief + onboarding + recent action history + target
// keywords. The previous current roadmap is archived before the new one
// is written.
//
// v74.19 — the model now does an inline mini-audit (homepage HTML +
// nav + body text + about page) before planning, AND accepts up to 8
// reference photos uploaded by the consultant (clinic interior, GMB
// screenshots, competitor SERPs, anything visual). Photos are shrunk
// to a vision-safe size and passed natively to Sonnet so the roadmap
// reflects what the model actually saw.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientBySlug } from "@/lib/notion";
import { getClientWebsite } from "@/lib/client-meta";
import { getOnboardingForSlug } from "@/lib/onboarding-store";
import { listTargetKeywords } from "@/lib/target-keywords-store";
import { ALL_ACTIONS } from "@/lib/seo-pillars";
import { listRecentHistoryAcrossActions } from "@/lib/action-history";
import {
  runMiniSiteAudit,
  formatMiniSiteAuditForPrompt,
} from "@/lib/seo-tools/mini-site-audit";
import { shrinkForVisionInput } from "@/lib/seo-tools/thumbnail";
import { appendRoadmapLog } from "@/lib/roadmap-changelog-store";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  archiveAndReplace,
  getCurrentRoadmap,
  MIN_ROADMAP_WEEKS,
  newRoadmapId,
  newTaskId,
  nextMondayISO,
  type Roadmap,
  type RoadmapTask,
} from "@/lib/roadmap-store";

// 5-minute ceiling matches the rest of the heavy AI routes — Vercel
// Pro is now active so the full value is honoured. Photo fetch + sharp
// shrink + Sonnet vision call comfortably fits.
export const runtime = "nodejs";
export const maxDuration = 300;

// Sonnet 4.6 — vision-capable, structured-output capable, and the
// quality bar we need now that the model is doing an inline audit +
// reading uploaded reference photos. Haiku was fine for blind
// week-bucketing, but for "look at this photo + this site + plan like
// an SEO pro" Sonnet is the right call. Typical wall-clock ~25–55s.
const MODEL_ID = "claude-sonnet-4-6";

// Hard caps so a misuse can't blow the function budget.
const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // 25 MB per photo on the wire
const PHOTO_FETCH_TIMEOUT_MS = 8000;

// Forgiving pillar parser — Sonnet occasionally renders the same value
// as "On-Page" / "on page" / "off_page" / "OffPage". We accept the
// common aliases and coerce to the canonical 6-value enum; anything
// else falls back to "technical" rather than failing the whole
// generation. Worst case the consultant re-pillars a couple of tasks
// in the editor — far better than getting nothing back.
const PILLAR_CANONICAL = [
  "technical",
  "on-page",
  "off-page",
  "local",
  "content",
  "research",
] as const;
const PILLAR_ALIASES: Record<string, (typeof PILLAR_CANONICAL)[number]> = {
  technical: "technical",
  tech: "technical",
  "on-page": "on-page",
  onpage: "on-page",
  on_page: "on-page",
  "on page": "on-page",
  "off-page": "off-page",
  offpage: "off-page",
  off_page: "off-page",
  "off page": "off-page",
  local: "local",
  "local seo": "local",
  content: "content",
  research: "research",
  investigation: "research",
};
const PillarSchema = z
  .string()
  .transform((raw) => {
    const key = raw.toLowerCase().trim();
    return PILLAR_ALIASES[key] ?? "technical";
  })
  .describe(
    "SEO pillar: one of technical, on-page, off-page, local, content, research. Mix pillars within each week.",
  );

const RoadmapTaskSchema = z.object({
  week: z
    .number()
    .int()
    .min(1)
    .max(12)
    .describe("Week column 1-12 inclusive."),
  title: z
    .string()
    .min(2)
    .max(240)
    .describe(
      "Short imperative task title — what the team will actually do. Examples: 'Website Deep Audit', '2 Blog Articles (all-on-4 cluster)', 'GMB Post 1', 'Scan and Optimize Header Tags'. No vague verbs like 'improve SEO'. Aim for under 120 chars; we'll truncate gracefully at 240.",
    ),
  pillar: PillarSchema,
});

// Schema is intentionally permissive on lower bounds — Sonnet sometimes
// returns 18-23 tasks or a 25-char auditSummary, and rejecting the WHOLE
// response over that is the wrong trade-off. The prompt still ASKS for
// 36-48 tasks; the schema just won't 502 when the model lands a hair
// short.
const RoadmapSchema = z.object({
  auditSummary: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "2–5 sentence SEO-audit headline: site identity inferred from the homepage, the 2-3 biggest gaps you see (technical, on-page, local, content, off-page, AI visibility), and what each uploaded photo contributed. Plain prose, no bullets. This anchors the roadmap to a real diagnosis. Aim for 120-600 chars.",
    ),
  tasks: z
    .array(RoadmapTaskSchema)
    .min(12)
    .max(60)
    .describe(
      "Tasks across the 12 weeks. AIM for 3-4 per week (36-48 total). Sequence: weeks 1-2 = audit + tracking setup + tech hygiene; weeks 3-8 = on-page + content + local + off-page execution; weeks 9-12 = strategic plays + measurement. Every week should have at least 3 tasks; the minimum is 12 only so a near-complete response isn't rejected.",
    ),
});

type GenerateBody = {
  startDate?: string;
  strategicFocus?: string;
  constraints?: string;
  photos?: string[];
};

type PhotoInput = {
  url: string;
  bytes: Uint8Array;
  mediaType: "image/jpeg";
  originalName: string;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 },
    );
  }

  let body: GenerateBody = {};
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    /* empty body is fine */
  }

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) {
    return NextResponse.json({ error: "Unknown client" }, { status: 404 });
  }

  const website = getClientWebsite(slug);

  const [brief, onboarding, history, targets, previous, miniAudit, photos] =
    await Promise.all([
      getBriefForSlug(slug),
      getOnboardingForSlug(slug),
      listRecentHistoryAcrossActions(
        slug,
        Array.from(new Set(ALL_ACTIONS.map((a) => a.action.slug))),
        15,
      ),
      listTargetKeywords(slug),
      getCurrentRoadmap(slug),
      website ? runMiniSiteAudit(website).catch(() => null) : Promise.resolve(null),
      fetchAndShrinkPhotos(body.photos ?? []),
    ]);

  const startDate =
    typeof body.startDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
      ? body.startDate
      : nextMondayISO();

  const briefBlock = formatBrief(brief);
  const historyBlock = formatHistory(history);
  const targetsBlock = formatTargets(targets);
  const onboardingBlock = onboarding?.extractedText
    ? `## Onboarding form (extracted text)\n\`\`\`\n${onboarding.extractedText.slice(0, 2000)}${onboarding.extractedText.length > 2000 ? "\n…[truncated]" : ""}\n\`\`\``
    : "";
  const previousBlock = previous
    ? `## Previous roadmap (just ran out / being replaced)\nStart date: ${previous.startDate}\nTasks (only those already 'implemented' should be credited as done):\n${previous.tasks
        .map(
          (t) => `- W${t.week} · [${t.status}] ${t.title} (${t.pillar})`,
        )
        .join("\n")}\n\nUse this to AVOID re-proposing work that's already done. Build on top of it.`
    : "";
  const auditBlock = miniAudit
    ? formatMiniSiteAuditForPrompt(miniAudit)
    : website
      ? `## Site audit\n_Mini site-audit fetch failed for ${website} — base the plan on brief + onboarding + history only and propose a Week 1 full-site audit task to recover the gap._`
      : `## Site audit\n_No website on file for this client. Add a Week 1 task to register the website + a deep audit once it's available._`;
  const photosBlock = photos.length > 0
    ? `## Reference photos uploaded by the consultant\n${photos.length} photo(s) attached natively to this prompt. They sit in front of this text as image content blocks — examine each one and let what you actually see drive the plan. Typical uses: clinic interior (signals brand voice + GMB photo gaps), GMB profile screenshot (signals review count + post cadence + category gaps), competitor SERP screenshot (signals what the SERP rewards), Google Search Console screenshot (signals indexation / impression cliffs). Cite the photos in the auditSummary by their visible content, not by index.`
    : `## Reference photos\n_None uploaded — proceed with the textual context only._`;

  const userPrompt = [
    `# Generate a fresh 12-week SEO roadmap for **${client.title}**`,
    `Start date (week 1 begins): **${startDate}**`,
    `Website: ${website ?? "(none on file)"}`,
    body.strategicFocus?.trim()
      ? `\n## Strategic focus from the consultant\n${body.strategicFocus.trim()}`
      : "",
    body.constraints?.trim()
      ? `\n## Constraints from the consultant\n${body.constraints.trim()}`
      : "",
    briefBlock,
    onboardingBlock,
    auditBlock,
    photosBlock,
    historyBlock,
    targetsBlock,
    previousBlock,
    "\n## How to think (think like an SEO pro before you plan)",
    "1. **Diagnose first.** Read the homepage title/meta/H1/nav/body text + every uploaded photo. Form a 2-sentence verdict on what this business actually does, who it serves, and the 2-3 biggest gaps blocking organic growth. Put that in `auditSummary`.",
    "2. **Sequence to first principles.** Foundations (indexation, tracking, schema, NAP) → on-page + content + GMB → off-page + AI/entity work → measurement. Don't propose link-building before the site is crawlable. Don't propose content scale before pillar pages exist.",
    "3. **Match the actual gap.** If the homepage has empty H1s, Week 1 includes 'Fix homepage H1 + headings'. If GMB photos are sparse (visible from the reference photos), schedule weekly photo uploads. If the audit reveals zero schema, schedule a schema rollout. **Tasks must follow from what you observed, not from a generic template.**",
    "4. **YMYL discipline.** Health & Wellness clients can't promise cures or guaranteed outcomes. Skip any task whose deliverable would force a non-compliant claim.",
    "5. **Honour the brief.** Client Don'ts are NEVER violated. Client Do's bias every choice. Notes are context — integrate them.",
    "\n## Design rules",
    "- Weeks 1-2: deep audit + GA4/GSC/GMB tracking setup + E-E-A-T scaffolding + fix anything broken the audit surfaces.",
    "- Weeks 3-8: content (1-2 articles/week tied to onboarding-form themes), backlink batches (relevance > raw DR), weekly GMB posts (cadence the photos may already show is missing), on-page passes, landing pages.",
    "- Weeks 9-12: AI/entity/schema work, follow-up linkbuilding, content insights, AI Overview / LLM-mention monitoring, reports.",
    "- Every week has at least 3 tasks. Aim 3-4 per week (36-48 total). Mix pillars within each week.",
    "- Be specific. Bad: 'Improve SEO'. Good: 'Scan and Optimize Image Alt Tags', 'GMB Reviews Responder — April batch', '2 Blog Articles (all-on-4 cluster)', 'Add MedicalClinic schema to /servicos pages'.",
    "- Honour Do's / Don'ts and consultant constraints.",
    "- If the previous roadmap just shipped an audit, propose the next step instead.",
  ]
    .filter(Boolean)
    .join("\n");

  const system = SYSTEM_PROMPT;

  // Build the multimodal user message. Photos go FIRST so the model
  // has them anchored before reading the textual context.
  const userContent: Array<
    | { type: "image"; image: Uint8Array; mediaType: string }
    | { type: "text"; text: string }
  > = [];
  for (const photo of photos) {
    userContent.push({
      type: "image",
      image: photo.bytes,
      mediaType: photo.mediaType,
    });
  }
  userContent.push({ type: "text", text: userPrompt });

  // Two-attempt loop. Sonnet very occasionally returns a structured
  // payload that doesn't conform — usually a stray pillar string, a
  // missing field, or the model just running short. We do one clean
  // attempt, then a stricter retry with an explicit "follow the schema
  // EXACTLY" reminder before failing. On a true second-attempt failure
  // we surface the raw text Claude produced so the consultant can see
  // what came back instead of a generic "did not match schema".
  let parsed: z.infer<typeof RoadmapSchema> | null = null;
  let lastError: unknown = null;
  let lastRawText: string | null = null;
  for (let attempt = 1; attempt <= 2 && !parsed; attempt++) {
    const attemptContent =
      attempt === 1
        ? userContent
        : ([
            ...userContent,
            {
              type: "text" as const,
              text: "\n\n## ⚠️ RETRY — previous attempt failed schema validation\nReturn the structured object EXACTLY as specified. Required fields: `auditSummary` (string, 1-2000 chars) and `tasks` (array of 12-60 items). Each task needs `week` (integer 1-12), `title` (string 2-240 chars), and `pillar` (one of exactly these lowercase strings: `technical`, `on-page`, `off-page`, `local`, `content`, `research`). Do NOT include any other fields. Do NOT wrap the response in extra prose. Aim for 36-48 tasks total, but 12 is acceptable if you genuinely can't justify more.",
            },
          ] satisfies typeof userContent);
    try {
      const result = await generateObject({
        model: anthropic(MODEL_ID),
        schema: RoadmapSchema,
        system,
        messages: [{ role: "user", content: attemptContent }],
        // Sized for ~48 short tasks + the auditSummary prose. Sonnet at
        // this budget runs 25-55s typical, well under the 300s ceiling.
        maxOutputTokens: 3000,
      });
      parsed = result.object;
    } catch (err) {
      lastError = err;
      if (NoObjectGeneratedError.isInstance(err)) {
        lastRawText = err.text ?? null;
        console.error(
          `[roadmap-generate] attempt ${attempt} schema mismatch. Raw text:`,
          (err.text ?? "(no text)").slice(0, 1200),
          "\nCause:",
          err.cause,
        );
      } else {
        console.error(`[roadmap-generate] attempt ${attempt} failed:`, err);
      }
    }
  }

  if (!parsed) {
    const baseMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    const hint = lastRawText
      ? ` Last raw output snippet: "${lastRawText.replace(/\s+/g, " ").slice(0, 200)}…". Try regenerating, or add a Strategic focus / Constraints to anchor the plan.`
      : " Try regenerating, or add a Strategic focus / Constraints to anchor the plan.";
    return NextResponse.json(
      { error: `Claude call failed after 2 attempts: ${baseMessage}.${hint}` },
      { status: 502 },
    );
  }

  const now = Date.now();
  let order = 0;
  const tasks: RoadmapTask[] = parsed.tasks.map((t) => ({
    id: newTaskId(),
    week: t.week,
    title: t.title.trim().slice(0, 240),
    status: "not_started",
    pillar: t.pillar,
    order: order++,
    statusChangedAt: now,
    createdAt: now,
  }));

  if (tasks.length === 0) {
    return NextResponse.json(
      {
        error:
          "Claude returned an empty task list. Try regenerating, or add a Strategic focus to anchor the plan.",
      },
      { status: 502 },
    );
  }

  const next: Roadmap = {
    id: newRoadmapId(),
    clientSlug: slug,
    // Generating always produces a fresh single-quarter plan; the
    // consultant grows it later via "Extend +3 months" on the board.
    weeks: MIN_ROADMAP_WEEKS,
    startDate,
    generatedAt: now,
    tasks,
    dismissedWarnings: [],
    auditSummary: parsed.auditSummary.trim(),
    sourcePhotos: photos.map((p) => ({ url: p.url, name: p.originalName })),
  };
  await archiveAndReplace(slug, next);
  // One compact "generated" entry instead of N task-add entries.
  try {
    const me = await getCurrentEmployee().catch(() => null);
    await appendRoadmapLog(slug, [{ k: "g", c: tasks.length }], me?.username);
  } catch (err) {
    console.error("roadmap changelog gen (non-fatal):", err);
  }
  // Bust the cached `/seo/[slug]` page so the CurrentRoadmapStrip
  // reflects the new roadmap immediately (was waiting up to 60s for the
  // page revalidate to fire on its own).
  revalidatePath(`/seo/${slug}`);

  return NextResponse.json({ roadmap: next });
}

const SYSTEM_PROMPT = `You are an internal SEO planning assistant at Wonder Ads (a Health & Wellness growth agency). You build operational 12-week roadmaps for one client at a time.

Think like a senior SEO consultant before you plan:
- **Diagnose first.** Read the live site audit + uploaded photos + brief + onboarding form. Form a verdict before sequencing tasks.
- **One page = one dominant intent.** Tasks that touch content respect search intent before chasing volume.
- **E-E-A-T is the lens.** Real experience, real expertise, real authority, real trust. YMYL bar applies to every Health & Wellness client — never plan tasks whose deliverable would force a medical claim, guaranteed outcome, or diagnosis.
- **Sequence to first principles.** Foundations (indexation, tracking, schema, NAP, Core Web Vitals) → on-page + content + GMB → off-page + AI/entity work → measurement. Don't propose link-building before the site is crawlable.
- **Local SEO.** NAP byte-identical across GMB, footer, schema, citations. GMB: one best-fit primary category, weekly posts, weekly photo uploads, 24-48h review response cadence.
- **AI visibility.** Plan for AI Overviews / ChatGPT citations: structured H2 answers, FAQPage schema, named entities, statistics.
- **Off-page.** Relevance > raw DR. Plan digital PR, broken-link replacement, resource-page mentions, expert quotes — never PBNs / paid networks / comment spam.
- **What to refuse.** Cloaking, doorway pages, link schemes, AI-spam at scale, fake reviews, medical-claim guarantees.

Output style:
- Tasks read like real action items a consultant would assign in a standup — short, specific, sequenced.
- The auditSummary is terse, factual prose. No marketing language. State the gap, name the photo or measurement that surfaced it.
- Match exactly the schema you're given.`;

async function fetchAndShrinkPhotos(urls: string[]): Promise<PhotoInput[]> {
  const out: PhotoInput[] = [];
  const trimmed = urls
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, MAX_PHOTOS);
  if (trimmed.length === 0) return out;

  // Sequential fetch+shrink — sharp is CPU-bound and we'd rather pace
  // it than blow heap on a dozen 8MB JPEGs at once.
  for (const url of trimmed) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        PHOTO_FETCH_TIMEOUT_MS,
      );
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        console.warn(`[roadmap-generate] photo fetch failed: ${url} → HTTP ${res.status}`);
        continue;
      }
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_PHOTO_BYTES) {
        console.warn(`[roadmap-generate] photo too large, skipped: ${url} (${ab.byteLength} bytes)`);
        continue;
      }
      const raw = new Uint8Array(ab);
      const shrunk = await shrinkForVisionInput(raw);
      out.push({
        url,
        bytes: shrunk.bytes,
        mediaType: shrunk.mimeType,
        originalName: extractFileName(url),
      });
    } catch (err) {
      console.warn(
        `[roadmap-generate] photo processing failed for ${url}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return out;
}

function extractFileName(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "photo";
    return decodeURIComponent(last);
  } catch {
    return "photo";
  }
}

function formatBrief(brief: {
  dos: string[];
  donts: string[];
  notes: string[];
}): string {
  const parts: string[] = [];
  if (brief.dos.length > 0) {
    parts.push(
      `### Client Do's\n${brief.dos.map((d) => `- ${d}`).join("\n")}`,
    );
  }
  if (brief.donts.length > 0) {
    parts.push(
      `### Client Don'ts (never violate)\n${brief.donts.map((d) => `- ${d}`).join("\n")}`,
    );
  }
  if (brief.notes.length > 0) {
    parts.push(`### Notes\n${brief.notes.map((n) => `- ${n}`).join("\n")}`);
  }
  if (parts.length === 0) return "";
  return `## Client brief\n${parts.join("\n\n")}`;
}

function formatHistory(
  history: { actionSlug: string; createdAt: number; output: string }[],
): string {
  if (history.length === 0) {
    return "## Recent action history\n_No prior runs on file for this client._";
  }
  const labelFor = (slug: string) =>
    ALL_ACTIONS.find((a) => a.action.slug === slug)?.action.label ?? slug;
  const lines = history.map((e) => {
    const when = new Date(e.createdAt).toISOString().slice(0, 10);
    const excerpt = (e.output ?? "").replace(/\s+/g, " ").slice(0, 100);
    return `- **${when}** · ${labelFor(e.actionSlug)} — ${excerpt}…`;
  });
  return `## Recent action history (last ${history.length})\n${lines.join("\n")}`;
}

function formatTargets(
  targets: {
    keyword: string;
    searchVolume?: number | null;
    difficulty?: number | null;
    intent?: string | null;
  }[],
): string {
  if (targets.length === 0) return "";
  const top = [...targets]
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 20);
  const lines = top.map(
    (t) =>
      `- ${t.keyword} (vol/mo ${t.searchVolume ?? "—"} · KD ${t.difficulty ?? "—"} · ${t.intent ?? "—"})`,
  );
  return `## Tracked target keywords (top ${top.length} by volume)\n${lines.join("\n")}`;
}
