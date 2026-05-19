// Generate a fresh 12-week SEO roadmap for a client.
//
// Uses Claude with a JSON-only response so the output drops straight into
// our `Roadmap` state. Grounds in the same context as the `client-roadmap`
// markdown action: brief + onboarding + recent action history + target
// keywords. The previous current roadmap is archived before the new one
// is written.

import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientBySlug } from "@/lib/notion";
import { getClientWebsite } from "@/lib/client-meta";
import { getOnboardingForSlug } from "@/lib/onboarding-store";
import { listTargetKeywords } from "@/lib/target-keywords-store";
import { ALL_ACTIONS } from "@/lib/seo-pillars";
import { listRecentHistoryAcrossActions } from "@/lib/action-history";
import {
  archiveAndReplace,
  getCurrentRoadmap,
  newRoadmapId,
  newTaskId,
  nextMondayISO,
  ROADMAP_PILLARS,
  ROADMAP_STATUSES,
  type Roadmap,
  type RoadmapPillar,
  type RoadmapStatus,
  type RoadmapTask,
} from "@/lib/roadmap-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL_ID = "claude-sonnet-4-6";

type GenerateBody = {
  startDate?: string; // YYYY-MM-DD
  strategicFocus?: string;
  constraints?: string;
};

type ClaudeTask = {
  week?: number;
  title?: string;
  description?: string;
  pillar?: string;
};

type ClaudeRoadmap = {
  tasks?: ClaudeTask[];
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

  const [brief, onboarding, history, targets, previous] = await Promise.all([
    getBriefForSlug(slug),
    getOnboardingForSlug(slug),
    listRecentHistoryAcrossActions(
      slug,
      Array.from(new Set(ALL_ACTIONS.map((a) => a.action.slug))),
      15,
    ),
    listTargetKeywords(slug),
    getCurrentRoadmap(slug),
  ]);

  const startDate =
    typeof body.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
      ? body.startDate
      : nextMondayISO();

  const briefBlock = formatBrief(brief);
  const historyBlock = formatHistory(history);
  const targetsBlock = formatTargets(targets);
  const onboardingBlock = onboarding?.extractedText
    ? `## Onboarding form (extracted text)\n\`\`\`\n${onboarding.extractedText.slice(0, 3000)}${onboarding.extractedText.length > 3000 ? "\n…[truncated]" : ""}\n\`\`\``
    : "";
  const previousBlock = previous
    ? `## Previous roadmap (just ran out / being replaced)\nStartDate: ${previous.startDate}\nTasks (only ones already implemented are still credit-worthy):\n${previous.tasks
        .map(
          (t) =>
            `- W${t.week} · [${t.status}] ${t.title} (${t.pillar})`,
        )
        .join("\n")}\n\nUse this to AVOID re-proposing work that's already done. Build on top of it.`
    : "";

  const userPrompt = [
    `# Generate a fresh 12-week SEO roadmap for **${client.title}**`,
    `Start date (Monday of week 1): **${startDate}**`,
    `Website: ${getClientWebsite(slug) ?? "(none on file)"}`,
    body.strategicFocus?.trim()
      ? `\n## Strategic focus from the consultant\n${body.strategicFocus.trim()}`
      : "",
    body.constraints?.trim()
      ? `\n## Constraints from the consultant\n${body.constraints.trim()}`
      : "",
    briefBlock,
    onboardingBlock,
    historyBlock,
    targetsBlock,
    previousBlock,
    "\n## Required output format\nReturn ONLY a JSON object — no prose, no markdown fences. Schema:",
    "```json",
    JSON.stringify(
      {
        tasks: [
          {
            week: "1-12 (integer)",
            title:
              "Short imperative task title (max ~80 chars). Examples: 'Website Deep Audit', 'Prepare EEAT Author Signature for Blog', 'Scan and Optimize Header Tags', 'GMB Post 1'.",
            description:
              "Optional 1-2 sentences of implementation notes the consultant will read. Skip if obvious from the title.",
            pillar:
              "one of: technical · on-page · off-page · local · content · research",
          },
        ],
      },
      null,
      2,
    ),
    "```",
    "\n## Roadmap design rules",
    "- Produce 4–7 tasks per week column on average. Aim for 50–70 total tasks across the 12 weeks.",
    "- Sequence foundational work first: Week 1-2 = deep audit + tracking setup + GA4/GSC/GMB hygiene. Week 3+ = the work itself.",
    "- Mix pillars within each week (rarely all tasks of one pillar in one week).",
    "- Be specific. Bad: 'Improve SEO'. Good: 'Scan and Optimize all Image Alt Tags' / 'GMB Reviews Responder — March batch' / '2 Blog Articles (cluster: all-on-4)'.",
    "- For Month 3 (weeks 9-12), it's OK for tasks to be lighter / more strategic — but every week must still have at least 3 tasks.",
    "- Honour the brief Do's / Don'ts and any constraints the consultant supplied. Don't propose anything the client said no to.",
    "- If the previous roadmap shows an audit was already shipped, don't propose another one in week 1 — propose the next logical step.",
    "- Output ONLY the JSON object. No commentary, no markdown fences.",
  ]
    .filter(Boolean)
    .join("\n");

  const system = `You are an internal SEO planning assistant at Wonder Ads (Health & Wellness growth agency). You build operational 12-week roadmaps for one client at a time. Output strict JSON matching the schema. Tasks should read like real action items a consultant would assign in a standup — short, specific, sequenced.`;

  let raw: string;
  try {
    const result = await generateText({
      model: anthropic(MODEL_ID),
      system,
      prompt: userPrompt,
      // Sized to fit ~60 task rows comfortably. Lower than the 4000 we
      // tried first because Claude was occasionally running long enough
      // that the response collided with Vercel's 60s function budget.
      maxOutputTokens: 3000,
    });
    raw = result.text ?? "";
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

  const parsed = parseJsonLoose<ClaudeRoadmap>(raw);
  if (!parsed || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    return NextResponse.json(
      {
        error:
          "Claude did not return parseable roadmap JSON. Try regenerating.",
        debug: raw.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const now = Date.now();
  let order = 0;
  const tasks: RoadmapTask[] = [];
  for (const t of parsed.tasks) {
    if (!t.title || typeof t.title !== "string") continue;
    const week = Math.max(1, Math.min(12, Math.floor(Number(t.week) || 1)));
    const pillar = isPillar(t.pillar) ? t.pillar : "technical";
    tasks.push({
      id: newTaskId(),
      week,
      title: t.title.trim().slice(0, 240),
      description:
        typeof t.description === "string" && t.description.trim()
          ? t.description.trim().slice(0, 2000)
          : undefined,
      status: "not_started" as RoadmapStatus,
      pillar,
      order: order++,
      statusChangedAt: now,
      createdAt: now,
    });
  }

  if (tasks.length === 0) {
    return NextResponse.json(
      { error: "No valid tasks parsed from Claude response." },
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
  };
  await archiveAndReplace(slug, next);

  return NextResponse.json({ roadmap: next });
}

function formatBrief(brief: {
  dos: string[];
  donts: string[];
  notes: string[];
}): string {
  const parts: string[] = [];
  if (brief.dos.length > 0) {
    parts.push(`### Client Do's\n${brief.dos.map((d) => `- ${d}`).join("\n")}`);
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

function parseJsonLoose<T>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^[\s\S]*?(\{)/, "$1") // strip anything before the first '{'
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Last-ditch: trim trailing comma garbage and re-parse.
    const end = cleaned.lastIndexOf("}");
    if (end > 0) {
      try {
        return JSON.parse(cleaned.slice(0, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

function isPillar(v: unknown): v is RoadmapPillar {
  return (
    typeof v === "string" &&
    (ROADMAP_PILLARS as readonly string[]).includes(v)
  );
}

// Silence unused warning — kept exported for future use.
void ROADMAP_STATUSES;
