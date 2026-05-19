// Generate a fresh 12-week SEO roadmap for a client.
//
// Uses Anthropic via the AI SDK's `generateObject` with a Zod schema so
// the output is *guaranteed* valid JSON matching our `Roadmap` shape —
// no more loose parsing or "Claude returned prose around the JSON"
// failure modes. Grounds in the same context as the `client-roadmap`
// markdown action: brief + onboarding + recent action history + target
// keywords. The previous current roadmap is archived before the new one
// is written.

import { NextResponse } from "next/server";
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
  archiveAndReplace,
  getCurrentRoadmap,
  newRoadmapId,
  newTaskId,
  nextMondayISO,
  type Roadmap,
  type RoadmapTask,
} from "@/lib/roadmap-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL_ID = "claude-sonnet-4-6";

const RoadmapTaskSchema = z.object({
  week: z
    .number()
    .int()
    .min(1)
    .max(12)
    .describe(
      "Which week column the task belongs to. Integer between 1 and 12 inclusive.",
    ),
  title: z
    .string()
    .min(2)
    .max(120)
    .describe(
      "Short imperative task title — what the consultant or team will actually do. Examples: 'Website Deep Audit', 'Prepare EEAT Author Signature for Blog', '2 Blog Articles (cluster: all-on-4)', 'GMB Post 1'. No vague verbs like 'improve SEO'.",
    ),
  description: z
    .string()
    .max(800)
    .optional()
    .describe(
      "Optional 1-2 sentences of implementation context the consultant will read. Skip when the title alone is enough.",
    ),
  pillar: z
    .enum(["technical", "on-page", "off-page", "local", "content", "research"])
    .describe(
      "Which SEO pillar this task belongs to. Mix pillars across each week (not all tasks of one pillar in one week).",
    ),
});

const RoadmapSchema = z.object({
  tasks: z
    .array(RoadmapTaskSchema)
    .min(20)
    .max(90)
    .describe(
      "All tasks across the 12 weeks. Aim for 4-7 tasks per week (50-70 total). Sequence: weeks 1-2 = audit + tracking setup + tech hygiene; weeks 3-8 = on-page + content + local + off-page execution; weeks 9-12 = strategic plays + measurement. Every week must have at least 3 tasks.",
    ),
});

type GenerateBody = {
  startDate?: string;
  strategicFocus?: string;
  constraints?: string;
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
    typeof body.startDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
      ? body.startDate
      : nextMondayISO();

  const briefBlock = formatBrief(brief);
  const historyBlock = formatHistory(history);
  const targetsBlock = formatTargets(targets);
  const onboardingBlock = onboarding?.extractedText
    ? `## Onboarding form (extracted text)\n\`\`\`\n${onboarding.extractedText.slice(0, 3000)}${onboarding.extractedText.length > 3000 ? "\n…[truncated]" : ""}\n\`\`\``
    : "";
  const previousBlock = previous
    ? `## Previous roadmap (just ran out / being replaced)\nStart date: ${previous.startDate}\nTasks (only those already 'implemented' should be credited as done):\n${previous.tasks
        .map(
          (t) => `- W${t.week} · [${t.status}] ${t.title} (${t.pillar})`,
        )
        .join("\n")}\n\nUse this to AVOID re-proposing work that's already done. Build on top of it.`
    : "";

  const userPrompt = [
    `# Generate a fresh 12-week SEO roadmap for **${client.title}**`,
    `Start date (week 1 begins): **${startDate}**`,
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
    "\n## Design rules (apply to the schema you fill out)",
    "- Sequence foundational work first. Week 1-2 = deep site audit + tracking setup (GA4 / GSC / GMB / Clarity if missing) + content/EEAT scaffolding.",
    "- Weeks 3-8: real production work — content (1-3 articles/week), backlink batches, GMB posts (weekly), on-page optimisation passes, landing pages.",
    "- Weeks 9-12: AI search readiness, entity/schema work, follow-up linkbuilding, content insights, GMB reports.",
    "- Every week needs at least 3 tasks. Aim 4-7 / week average. Mix pillars within each week.",
    "- Be specific. Bad: 'Improve SEO'. Good: 'Scan and Optimize all Image Alt Tags', 'GMB Reviews Responder — April batch', '2 Blog Articles (all-on-4 cluster)'.",
    "- Honour the client's Do's / Don'ts and any consultant constraints above. Don't propose anything the client said no to.",
    "- If the previous roadmap shows an audit was just shipped, don't propose another one in week 1 — propose what comes next (e.g. ship the audit fixes).",
  ]
    .filter(Boolean)
    .join("\n");

  const system = `You are an internal SEO planning assistant at Wonder Ads (Health & Wellness growth agency). You build operational 12-week roadmaps for one client at a time. Tasks should read like real action items a consultant would assign in a standup — short, specific, sequenced. Match exactly the schema you're given.`;

  let parsed: z.infer<typeof RoadmapSchema>;
  try {
    const result = await generateObject({
      model: anthropic(MODEL_ID),
      schema: RoadmapSchema,
      system,
      prompt: userPrompt,
      // Sized to fit ~70 task rows comfortably under Vercel's 60s budget.
      maxOutputTokens: 3500,
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
    description: t.description?.trim() || undefined,
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
