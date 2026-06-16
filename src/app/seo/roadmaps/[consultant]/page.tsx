// Per-consultant "my week" roadmap overview.
//
// An SEO consultant opens this from their own column header on /seo to see
// EVERY one of their projects' roadmaps + exactly which tasks are due THIS
// week across all of them — so they know what to do first and second.
//
// Access: the consultant themselves OR a SuperAdmin (Andre/Alex/Alice).
// Every other logged-in user gets the Access Denied screen.

import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { Greeting } from "@/components/greeting";
import { ConsultantWeekView } from "@/components/consultant-week-view";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import { CONSULTANT_ORDER } from "@/lib/client-overrides";
import { slugify } from "@/lib/notion";
import { getConsultantWeekView } from "@/lib/roadmap-admin-helpers";
import { formatDateLong } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Resolve the canonical consultant name from a URL slug. */
function consultantFromSlug(consultantSlug: string): string | null {
  return (
    CONSULTANT_ORDER.find((name) => slugify(name) === consultantSlug) ?? null
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ consultant: string }>;
}) {
  const { consultant } = await params;
  const name = consultantFromSlug(consultant);
  return {
    title: name ? `${name} — My Week · Wonder Ads` : "My Week · Wonder Ads",
  };
}

export default async function ConsultantWeekPage({
  params,
}: {
  params: Promise<{ consultant: string }>;
}) {
  const { consultant } = await params;
  const consultantName = consultantFromSlug(consultant);
  if (!consultantName) notFound();

  const employee = await getCurrentEmployee();
  // SEO access is a prerequisite; then it must be this consultant or an
  // admin. (employee.name matches the consultant display name — they were
  // renamed in lockstep, see credentials.ts + client-overrides.ts.)
  const allowed =
    employee &&
    accessibleDepts(employee).includes("seo") &&
    (employee.isAdmin || employee.name === consultantName);

  if (!allowed) {
    return (
      <PageShell backHref="/seo" backLabel="SEO DPT">
        <AccessDenied
          title="Private overview"
          description={`This weekly overview belongs to ${consultantName}. Only ${consultantName} and the SuperAdmins can open it.`}
          backHref="/seo"
          backLabel="SEO DPT"
          username={employee?.username ?? null}
        />
      </PageShell>
    );
  }

  const view = await getConsultantWeekView(consultantName);
  const firstName = consultantName.split(/\s+/)[0].replace(/\.$/, "");

  return (
    <PageShell wide backHref="/seo" backLabel="SEO DPT">
      <header className="animate-fade-up mt-2">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">
            <Greeting name={firstName} />
          </span>{" "}
          <span aria-hidden>👋</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          {formatDateLong(new Date())} ·{" "}
          {view.totals.thisWeekRemaining > 0 ? (
            <>
              You have{" "}
              <span className="font-semibold text-white/85">
                {view.totals.thisWeekRemaining} task
                {view.totals.thisWeekRemaining === 1 ? "" : "s"}
              </span>{" "}
              to tackle this week across{" "}
              <span className="font-semibold text-white/85">
                {view.clients.filter((c) => c.hasRoadmap).length} project
                {view.clients.filter((c) => c.hasRoadmap).length === 1
                  ? ""
                  : "s"}
              </span>
              . Top of each card = do it first.
            </>
          ) : (
            <>You&apos;re all caught up on this week&apos;s tasks. Nice. 🎯</>
          )}
        </p>
      </header>

      <ConsultantWeekView view={view} />
    </PageShell>
  );
}
