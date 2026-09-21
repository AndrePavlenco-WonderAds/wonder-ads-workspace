// The pure half of roadmap generation: the Zod schema Claude must fill,
// the task/token budgets, the month calendar and the sequencing rules
// that scale with the plan length, and the system prompt.
//
// Kept apart from the API route (which does the KV / Notion / Blob /
// photo work) so this can be exercised on its own — the v77.42 move to
// calendar months made the schema depend on the start date + month count
// and it had to be checked against a real Sonnet call without touching a
// client's roadmap.

import { z } from "zod";
import { roadmapMonths, type Roadmap } from "./roadmap-store";
import { formatDate } from "./dates";

// Forgiving pillar parser — Sonnet occasionally renders the same value
// as "On-Page" / "on page" / "off_page" / "OffPage". We accept the
// common aliases and coerce to the canonical 6-value enum; anything
// else falls back to "technical" rather than failing the whole
// generation. Worst case the consultant re-pillars a couple of tasks
// in the editor — far better than getting nothing back.
type CanonicalPillar =
  | "technical"
  | "on-page"
  | "off-page"
  | "local"
  | "content"
  | "research";
const PILLAR_ALIASES: Record<string, CanonicalPillar> = {
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

/** Task budget the prompt asks for: 3–4 per week. The schema's ceiling
 *  sits above the top of that range so a generous model isn't rejected. */
export function taskBudget(totalWeeks: number): {
  min: number;
  max: number;
  cap: number;
} {
  return {
    min: totalWeeks * 3,
    max: totalWeeks * 4,
    cap: Math.min(220, totalWeeks * 5),
  };
}

/** ~45 output tokens per task + room for the auditSummary. A quarter
 *  (13-14 weeks) lands around 4k, six months ~6.5k, a full year ~11k —
 *  Sonnet streams that in 1-3 minutes, under the route's 300s ceiling. */
export function outputTokenBudget(totalWeeks: number): number {
  return Math.min(16_000, 1_500 + taskBudget(totalWeeks).max * 45);
}

/** The schema is built per request because the week range and task
 *  ceiling depend on the plan length. Intentionally permissive on lower
 *  bounds — Sonnet sometimes lands a few tasks short or writes a 25-char
 *  auditSummary, and rejecting the WHOLE response over that is the wrong
 *  trade-off. The prompt still ASKS for 3–4 tasks per week; the schema
 *  just won't 502 when the model lands a hair short. */
export function buildRoadmapSchema(totalWeeks: number) {
  const budget = taskBudget(totalWeeks);
  const taskSchema = z.object({
    week: z
      .number()
      .int()
      .min(1)
      .max(totalWeeks)
      .describe(`Week column 1-${totalWeeks} inclusive.`),
    title: z
      .string()
      .min(2)
      .max(240)
      .describe(
        "Short imperative task title — what the team will actually do. Examples: 'Website Deep Audit', '2 Blog Articles (all-on-4 cluster)', 'GMB Post 1', 'Scan and Optimize Header Tags'. No vague verbs like 'improve SEO'. Aim for under 120 chars; we'll truncate gracefully at 240.",
      ),
    pillar: PillarSchema,
  });
  return z.object({
    auditSummary: z
      .string()
      .min(1)
      .max(2000)
      .describe(
        "2–5 sentence SEO-audit headline: site identity inferred from the homepage, the 2-3 biggest gaps you see (technical, on-page, local, content, off-page, AI visibility), and what each uploaded photo contributed. Plain prose, no bullets. This anchors the roadmap to a real diagnosis. Aim for 120-600 chars.",
      ),
    tasks: z
      .array(taskSchema)
      .min(12)
      .max(budget.cap)
      .describe(
        `Tasks across all ${totalWeeks} weeks. AIM for 3-4 per week (${budget.min}-${budget.max} total). Every week should have at least 3 tasks; the minimum of 12 exists only so a near-complete response isn't rejected.`,
      ),
  });
}

export type GeneratedRoadmap = z.infer<ReturnType<typeof buildRoadmapSchema>>;

/** Which weeks belong to which calendar month, with dates — so the model
 *  plans against the real calendar (seasonality, month-end reports) and
 *  never assumes a month is exactly four weeks. */
export function formatMonthCalendar(
  roadmap: Pick<Roadmap, "startDate" | "months">,
): string {
  const lines = roadmapMonths(roadmap).map(
    (m) =>
      `- ${m.name}: weeks ${m.weeks[0]}–${m.weeks[m.weeks.length - 1]} (${formatDate(m.start)} – ${formatDate(m.end)})`,
  );
  return `## Month calendar (calendar months from the start date, four weeks each — week 4 of a month runs to the month's last day, so it is 8–10 days)\n${lines.join("\n")}`;
}

/** Sequencing guidance that scales with the plan: a quarter is
 *  foundations → execution → strategic; anything longer repeats a monthly
 *  cadence and closes every quarter with a review. */
export function designRules(totalWeeks: number, months: number): string[] {
  const budget = taskBudget(totalWeeks);
  const finalMonthStart = Math.max(3, totalWeeks - 3);
  const rules = [
    "- Weeks 1-2: deep audit + GA4/GSC/GMB tracking setup + E-E-A-T scaffolding + fix anything broken the audit surfaces.",
    `- Weeks 3-${finalMonthStart - 1}: content (1-2 articles/week tied to onboarding-form themes), backlink batches (relevance > raw DR), weekly GMB posts (cadence the photos may already show is missing), on-page passes, landing pages.`,
    `- Weeks ${finalMonthStart}-${totalWeeks} (the final month): AI/entity/schema work, follow-up linkbuilding, content insights, AI Overview / LLM-mention monitoring, the end-of-package report and the renewal conversation.`,
  ];
  if (months > 3) {
    rules.push(
      `- This is a ${months}-month plan, not a quarter. After the foundations, every calendar month keeps a steady cadence (content + GMB + backlinks + one on-page or technical pass) and ends with a short measurement task; every third month closes with a 'Quarterly review + re-plan' task. Escalate difficulty over time — month 1 fixes basics, later months build authority and topical depth. Never repeat the same task title month after month; name what changes (which cluster, which pages, which batch).`,
    );
  }
  rules.push(
    `- Every week has at least 3 tasks. Aim 3-4 per week (${budget.min}-${budget.max} total). Mix pillars within each week.`,
    "- Be specific. Bad: 'Improve SEO'. Good: 'Scan and Optimize Image Alt Tags', 'GMB Reviews Responder — April batch', '2 Blog Articles (all-on-4 cluster)', 'Add MedicalClinic schema to /servicos pages'.",
    "- Honour Do's / Don'ts and consultant constraints.",
    "- If the previous roadmap just shipped an audit, propose the next step instead.",
  );
  return rules;
}

/** The retry nudge appended when the first attempt fails schema
 *  validation — repeats the exact shape with the real bounds. */
export function retryInstructions(totalWeeks: number): string {
  const budget = taskBudget(totalWeeks);
  return `\n\n## ⚠️ RETRY — previous attempt failed schema validation\nReturn the structured object EXACTLY as specified. Required fields: \`auditSummary\` (string, 1-2000 chars) and \`tasks\` (array of 12-${budget.cap} items). Each task needs \`week\` (integer 1-${totalWeeks}), \`title\` (string 2-240 chars), and \`pillar\` (one of exactly these lowercase strings: \`technical\`, \`on-page\`, \`off-page\`, \`local\`, \`content\`, \`research\`). Do NOT include any other fields. Do NOT wrap the response in extra prose. Aim for ${budget.min}-${budget.max} tasks total, but 12 is acceptable if you genuinely can't justify more.`;
}

export const SYSTEM_PROMPT = `You are an internal SEO planning assistant at Wonder Ads (a Health & Wellness growth agency). You build operational week-by-week roadmaps — 3 to 12 calendar months long — for one client at a time.

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
