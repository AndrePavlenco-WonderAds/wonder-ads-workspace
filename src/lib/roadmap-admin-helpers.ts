// Server-side aggregation for the SuperAdmin → Roadmaps view.
//
// Pulls the live roadmap for every SEO client, computes the per-client
// stats Andre wanted in the dashboard (weeks elapsed, tasks done past
// weeks, tasks pending review, weeks with overdue tasks), then groups
// the result by Head Consultant so the page can render one section
// per consultant.
//
// Why this lives outside the page file: the same shape is useful in
// any future surface that wants to slice roadmaps by consultant (a
// monthly report, a Slack digest, etc.). Keep the data shape stable.

import {
  currentWeekIndex,
  getCurrentRoadmap,
  roadmapWeeks,
  MIN_ROADMAP_WEEKS,
  type Roadmap,
  type RoadmapStatus,
  type RoadmapPillar,
} from "./roadmap-store";
import { getConsultantForSlug, CONSULTANT_ORDER } from "./client-overrides";
import { EXCLUDED_SLUGS } from "./client-overrides";
import { getSeoClients } from "./notion";

/** A single client row inside a consultant section. */
export type ConsultantClientRow = {
  slug: string;
  title: string;
  /** True when no roadmap is on file for this client yet — the card
   *  renders a "Generate roadmap" CTA instead of stats. */
  hasRoadmap: boolean;
  /** The roadmap's startDate (Monday of week 1). null when missing. */
  startDate: string | null;
  /** Original agency-engagement date — kept pinned across roadmap
   *  resets so the consultant always sees the historical anchor. */
  onboardingDate: string | null;
  /** 1–totalWeeks normally, 0 if not started, >totalWeeks if past the
   *  horizon. */
  currentWeek: number;
  /** The roadmap's full span in weeks (12, 24, 36, …) — grows as the
   *  consultant extends the plan. 12 when no roadmap is on file. */
  totalWeeks: number;
  /** Total task count in the roadmap. */
  totalTasks: number;
  /** Tasks with status === "implemented", in any week. */
  doneTasks: number;
  /** Tasks with status === "implemented" whose week < currentWeek. */
  donePastWeeks: number;
  /** Tasks with status === "pending_review" (any week). */
  pendingApproval: number;
  /** Tasks in past weeks (week < currentWeek) NOT yet implemented.
   *  The "falling behind" surface. */
  overduePastWeeks: number;
  /** Distinct weeks (< currentWeek) that contain at least one
   *  non-implemented task — i.e. the count of past weeks the
   *  consultant still owes work on. */
  overdueWeekCount: number;
  /** Health flag derived from the same thresholds the in-board
   *  warnings use: critical → 5+ overdue, behind → 2-4 overdue,
   *  on-track → everything else. */
  health: "on-track" | "behind" | "critical" | "no-roadmap" | "not-started";
};

/** Aggregated stats for the whole consultant section (sum across
 *  their assigned clients). */
export type ConsultantSection = {
  consultant: string;
  email: string | null;
  clients: ConsultantClientRow[];
  /** Of the consultant's clients, how many have a roadmap on file. */
  withRoadmap: number;
  /** Sum of all done tasks across the consultant's clients. */
  totalDone: number;
  /** Sum of all pending-review tasks across the consultant's clients. */
  totalPendingApproval: number;
  /** Sum of all past-week non-implemented tasks across all their clients. */
  totalOverdue: number;
  /** Sum of all overdue WEEKS across all their clients. */
  totalOverdueWeeks: number;
  /** Average current week across active roadmaps (rounded to 0.1). 0 if
   *  no roadmaps. */
  avgCurrentWeek: number;
};

export type RoadmapAdminSummary = {
  /** One section per consultant in CONSULTANT_ORDER. Unassigned clients
   *  drop into their own trailing section so they're not lost. */
  sections: ConsultantSection[];
  /** Roster-wide totals — feed the top stat row + the landing card badge. */
  totals: {
    clientsAssigned: number;
    clientsWithRoadmap: number;
    consultantsActive: number;
    pendingApproval: number;
    overdue: number;
  };
  /** True when getSeoClients() threw (Notion outage). Lets the page
   *  show a warning row instead of an empty board. */
  notionUnavailable: boolean;
};

const EMAIL_BY_CONSULTANT: Record<string, string> = {
  "Fran. Rosa": "fran@wonder-ads.com",
  "Yenisey Rodriguez": "yeni@wonder-ads.com",
  "Manuel Silva": "manuel@wonder-ads.com",
  "André Pereira": "andre.pereira@wonder-ads.com",
};

function classifyHealth(
  hasRoadmap: boolean,
  currentWeek: number,
  overduePastWeeks: number,
): ConsultantClientRow["health"] {
  if (!hasRoadmap) return "no-roadmap";
  if (currentWeek === 0) return "not-started";
  if (overduePastWeeks >= 5) return "critical";
  if (overduePastWeeks >= 2) return "behind";
  return "on-track";
}

function statusCount(tasks: Roadmap["tasks"], status: RoadmapStatus): number {
  let n = 0;
  for (const t of tasks) if (t.status === status) n++;
  return n;
}

function statsForRoadmap(roadmap: Roadmap, now: number = Date.now()) {
  const currentWeek = currentWeekIndex(roadmap, now);
  const totalTasks = roadmap.tasks.length;
  const doneTasks = statusCount(roadmap.tasks, "implemented");
  const pendingApproval = statusCount(roadmap.tasks, "pending_review");
  // Past-week buckets: only meaningful once we're at week >= 2.
  let donePastWeeks = 0;
  let overduePastWeeks = 0;
  const overdueWeeks = new Set<number>();
  if (currentWeek >= 2) {
    for (const t of roadmap.tasks) {
      if (t.week >= currentWeek) continue;
      if (t.status === "implemented") {
        donePastWeeks++;
      } else if (t.status === "pending_review") {
        // "For approval" — sitting with the client for sign-off. It's
        // already counted in `pendingApproval` (the purple block) and is
        // NOT the consultant's backlog, so it must NOT also land in the
        // red "Overdue" block. Excluding it here is the fix for the
        // double-count: red = genuinely-stuck work only (not_started /
        // in_progress), purple = for-approval, green = done.
      } else {
        // not_started / in_progress in a past week → genuinely overdue.
        overduePastWeeks++;
        overdueWeeks.add(t.week);
      }
    }
  }
  return {
    currentWeek,
    totalTasks,
    doneTasks,
    donePastWeeks,
    pendingApproval,
    overduePastWeeks,
    overdueWeekCount: overdueWeeks.size,
  };
}

/** Fetches the full picture: every SEO client + their roadmap (if any)
 *  + per-client stats + grouped by consultant. */
export async function getRoadmapAdminSummary(
  now: number = Date.now(),
): Promise<RoadmapAdminSummary> {
  let seoClients: { slug: string; title: string }[] = [];
  let notionUnavailable = false;
  try {
    const fetched = await getSeoClients();
    seoClients = fetched
      .filter((c) => !EXCLUDED_SLUGS.has(c.slug))
      .map((c) => ({ slug: c.slug, title: c.title }));
  } catch {
    notionUnavailable = true;
  }

  // Pull every roadmap in parallel — one KV round trip each, all run
  // at once via Promise.all. With 18 SEO clients this is one ~50ms
  // batch, not 18 sequential round trips.
  const roadmaps = await Promise.all(
    seoClients.map(async (c) => ({
      client: c,
      roadmap: await getCurrentRoadmap(c.slug),
    })),
  );

  // Build the per-client rows.
  const rows: ConsultantClientRow[] = roadmaps.map(({ client, roadmap }) => {
    if (!roadmap) {
      return {
        slug: client.slug,
        title: client.title,
        hasRoadmap: false,
        startDate: null,
        onboardingDate: null,
        currentWeek: 0,
        totalWeeks: MIN_ROADMAP_WEEKS,
        totalTasks: 0,
        doneTasks: 0,
        donePastWeeks: 0,
        pendingApproval: 0,
        overduePastWeeks: 0,
        overdueWeekCount: 0,
        health: "no-roadmap",
      };
    }
    const s = statsForRoadmap(roadmap, now);
    return {
      slug: client.slug,
      title: client.title,
      hasRoadmap: true,
      startDate: roadmap.startDate,
      onboardingDate: roadmap.onboardingDate ?? null,
      currentWeek: s.currentWeek,
      totalWeeks: roadmapWeeks(roadmap),
      totalTasks: s.totalTasks,
      doneTasks: s.doneTasks,
      donePastWeeks: s.donePastWeeks,
      pendingApproval: s.pendingApproval,
      overduePastWeeks: s.overduePastWeeks,
      overdueWeekCount: s.overdueWeekCount,
      health: classifyHealth(true, s.currentWeek, s.overduePastWeeks),
    };
  });

  // Group by consultant (live re-resolution from slug — never trust a
  // cached `consultant` field per the v74.x cached-rename trap).
  const byConsultant = new Map<string, ConsultantClientRow[]>();
  for (const r of rows) {
    const consultant = getConsultantForSlug(r.slug);
    const bucket = byConsultant.get(consultant) ?? [];
    bucket.push(r);
    byConsultant.set(consultant, bucket);
  }

  // Build sections in the canonical display order; append any
  // unassigned slugs in a trailing section so they're not lost.
  const sections: ConsultantSection[] = [];
  const orderedConsultants = [
    ...CONSULTANT_ORDER,
    ...Array.from(byConsultant.keys()).filter(
      (c) => !(CONSULTANT_ORDER as readonly string[]).includes(c),
    ),
  ];
  for (const consultant of orderedConsultants) {
    const clients = byConsultant.get(consultant);
    if (!clients || clients.length === 0) continue;
    // Inside the section, sort clients by health desc (critical first)
    // then alphabetical title.
    const healthRank: Record<ConsultantClientRow["health"], number> = {
      critical: 0,
      behind: 1,
      "no-roadmap": 2,
      "not-started": 3,
      "on-track": 4,
    };
    clients.sort((a, b) => {
      const h = healthRank[a.health] - healthRank[b.health];
      if (h !== 0) return h;
      return a.title.localeCompare(b.title);
    });
    const withRoadmap = clients.filter((c) => c.hasRoadmap).length;
    const totalDone = clients.reduce((s, c) => s + c.doneTasks, 0);
    const totalPendingApproval = clients.reduce(
      (s, c) => s + c.pendingApproval,
      0,
    );
    const totalOverdue = clients.reduce(
      (s, c) => s + c.overduePastWeeks,
      0,
    );
    const totalOverdueWeeks = clients.reduce(
      (s, c) => s + c.overdueWeekCount,
      0,
    );
    const activeWeeks = clients
      .filter((c) => c.hasRoadmap && c.currentWeek > 0)
      .map((c) => c.currentWeek);
    const avgCurrentWeek =
      activeWeeks.length > 0
        ? Math.round(
            (activeWeeks.reduce((s, w) => s + w, 0) / activeWeeks.length) * 10,
          ) / 10
        : 0;
    sections.push({
      consultant,
      email: EMAIL_BY_CONSULTANT[consultant] ?? null,
      clients,
      withRoadmap,
      totalDone,
      totalPendingApproval,
      totalOverdue,
      totalOverdueWeeks,
      avgCurrentWeek,
    });
  }

  // Roster-wide totals — feed the stat row + the landing card badge.
  const totals = {
    clientsAssigned: rows.length,
    clientsWithRoadmap: rows.filter((r) => r.hasRoadmap).length,
    consultantsActive: sections.length,
    pendingApproval: rows.reduce((s, r) => s + r.pendingApproval, 0),
    overdue: rows.reduce((s, r) => s + r.overduePastWeeks, 0),
  };

  return { sections, totals, notionUnavailable };
}

/** Lightweight version for the landing card — returns just the count
 *  the badge needs (clients with a roadmap on file). Avoids the full
 *  per-client aggregation when the caller only wants the headline
 *  number. Falls back to 0 when Notion is unavailable. */
export async function countRoadmaps(): Promise<number> {
  try {
    const fetched = await getSeoClients();
    const slugs = fetched
      .map((c) => c.slug)
      .filter((s) => !EXCLUDED_SLUGS.has(s));
    const results = await Promise.all(
      slugs.map((s) => getCurrentRoadmap(s).then((r) => Boolean(r))),
    );
    return results.filter(Boolean).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Per-consultant "my week" view — powers /seo/roadmaps/[consultant].
// Same per-client stats as the admin summary, PLUS the actual tasks for
// the current week of each roadmap so the consultant can see exactly what
// to do first/second across all their projects this week.
// ---------------------------------------------------------------------------

export type WeekTask = {
  id: string;
  title: string;
  description?: string;
  pillar: RoadmapPillar;
  status: RoadmapStatus;
};

export type ConsultantWeekClient = {
  slug: string;
  title: string;
  hasRoadmap: boolean;
  currentWeek: number;
  /** The roadmap's full span in weeks (12, 24, …). 12 when no roadmap. */
  totalWeeks: number;
  totalTasks: number;
  doneTasks: number;
  health: ConsultantClientRow["health"];
  /** Tasks whose week === currentWeek, in the consultant's own order. */
  thisWeekTasks: WeekTask[];
  thisWeekDone: number;
  overduePastWeeks: number;
  pendingApproval: number;
};

export type ConsultantWeekView = {
  consultant: string;
  email: string | null;
  clients: ConsultantWeekClient[];
  totals: {
    clients: number;
    withRoadmap: number;
    thisWeekTasks: number;
    thisWeekRemaining: number;
    overdue: number;
    pendingApproval: number;
  };
  notionUnavailable: boolean;
};

export async function getConsultantWeekView(
  consultantName: string,
  now: number = Date.now(),
): Promise<ConsultantWeekView> {
  let seoClients: { slug: string; title: string }[] = [];
  let notionUnavailable = false;
  try {
    const fetched = await getSeoClients();
    seoClients = fetched
      .filter(
        (c) =>
          !EXCLUDED_SLUGS.has(c.slug) &&
          getConsultantForSlug(c.slug) === consultantName,
      )
      .map((c) => ({ slug: c.slug, title: c.title }));
  } catch {
    notionUnavailable = true;
  }

  const roadmaps = await Promise.all(
    seoClients.map(async (c) => ({
      client: c,
      roadmap: await getCurrentRoadmap(c.slug),
    })),
  );

  const clients: ConsultantWeekClient[] = roadmaps.map(({ client, roadmap }) => {
    if (!roadmap) {
      return {
        slug: client.slug,
        title: client.title,
        hasRoadmap: false,
        currentWeek: 0,
        totalWeeks: MIN_ROADMAP_WEEKS,
        totalTasks: 0,
        doneTasks: 0,
        health: "no-roadmap",
        thisWeekTasks: [],
        thisWeekDone: 0,
        overduePastWeeks: 0,
        pendingApproval: 0,
      };
    }
    const s = statsForRoadmap(roadmap, now);
    const cw = s.currentWeek;
    const inWeek = roadmap.tasks
      .filter((t) => t.week === cw)
      .sort((a, b) => a.order - b.order);
    return {
      slug: client.slug,
      title: client.title,
      hasRoadmap: true,
      currentWeek: cw,
      totalWeeks: roadmapWeeks(roadmap),
      totalTasks: s.totalTasks,
      doneTasks: s.doneTasks,
      health: classifyHealth(true, cw, s.overduePastWeeks),
      thisWeekTasks: inWeek.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        pillar: t.pillar,
        status: t.status,
      })),
      thisWeekDone: inWeek.filter((t) => t.status === "implemented").length,
      overduePastWeeks: s.overduePastWeeks,
      pendingApproval: s.pendingApproval,
    };
  });

  // Surface the projects that still have work THIS week first, then by
  // health severity, then alphabetically — so the consultant's eye lands
  // on what to do first.
  const healthRank: Record<ConsultantClientRow["health"], number> = {
    critical: 0,
    behind: 1,
    "no-roadmap": 2,
    "not-started": 3,
    "on-track": 4,
  };
  const remaining = (c: ConsultantWeekClient) =>
    c.thisWeekTasks.filter((t) => t.status !== "implemented").length;
  clients.sort((a, b) => {
    const ar = remaining(a) > 0 ? 0 : 1;
    const br = remaining(b) > 0 ? 0 : 1;
    if (ar !== br) return ar - br;
    const h = healthRank[a.health] - healthRank[b.health];
    if (h !== 0) return h;
    return a.title.localeCompare(b.title);
  });

  return {
    consultant: consultantName,
    email: EMAIL_BY_CONSULTANT[consultantName] ?? null,
    clients,
    totals: {
      clients: clients.length,
      withRoadmap: clients.filter((c) => c.hasRoadmap).length,
      thisWeekTasks: clients.reduce((s, c) => s + c.thisWeekTasks.length, 0),
      thisWeekRemaining: clients.reduce((s, c) => s + remaining(c), 0),
      overdue: clients.reduce((s, c) => s + c.overduePastWeeks, 0),
      pendingApproval: clients.reduce((s, c) => s + c.pendingApproval, 0),
    },
    notionUnavailable,
  };
}
