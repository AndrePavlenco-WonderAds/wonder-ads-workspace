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
import { generateObject } from "ai";
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
import {
  archiveAndReplace,
  getCurrentRoadmap,
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
    .max(120)
    .describe(
      "Short imperative task title — what the team will actually do. Examples: 'Website Deep Audit', '2 Blog Articles (all-on-4 cluster)', 'GMB Post 1', 'Scan and Optimize Header Tags'. No vague verbs like 'improve SEO'. Description is left blank — consultant fills in after.",
    ),
  pillar: z
    .enum(["technical", "on-page", "off-page", "local", "content", "research"])
    .describe(
      "SEO pillar this task belongs to. Mix pillars across each week (not all tasks of one pillar in one week).",
    ),
});

const RoadmapSchema = z.object({
  auditSummary: z
    .string()
    .min(40)
    .max(1200)
    .describe(
      "2–5 sentence SEO-audit headline: site identity inferred from the homepage, the 2-3 biggest gaps you see (technical, on-page, local, content, off-page, AI visibility), and what each uploaded photo contributed. Plain prose, no bullets. This anchors the roadmap to a real diagnosis.",
    ),
  tasks: z
    .array(RoadmapTaskSchema)
    .min(24)
    .max(50)
    .describe(
      "Tasks across the 12 weeks. 3-4 per week average (36-48 total). Sequence: weeks 1-2 = audit + tracking setup + tech hygiene; weeks 3-8 = on-page + content + local + off-page execution; weeks 9-12 = strategic plays + measurement. Every week must have at least 3 tasks.",
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

  let parsed: z.infer<typeof RoadmapSchema>;
  try {
    const result = await generateObject({
      model: anthropic(MODEL_ID),
      schema: RoadmapSchema,
      system,
      messages: [{ role: "user", content: userContent }],
      // Sized for ~48 short tasks + the auditSummary prose. Sonnet at
      // this budget runs 25-55s typical, well under the 300s ceiling.
      maxOutputTokens: 3000,
    });
    parsed = result.object;
  } catch (err) {
    return NextResponse.json(
      {
        error: `Claude call failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
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
    startDate,
    generatedAt: now,
    tasks,
    dismissedWarnings: [],
    auditSummary: parsed.auditSummary.trim(),
    sourcePhotos: photos.map((p) => ({ url: p.url, name: p.originalName })),
  };
  await archiveAndReplace(slug, next);
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
