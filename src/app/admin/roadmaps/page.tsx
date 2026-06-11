// SuperAdmin → Roadmaps view.
//
// Gating is inherited from /admin/layout.tsx (v74.23+) — every page
// under /admin/* checks isAdmin BEFORE rendering, so this file
// doesn't need its own guard.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminRoadmapsPanel } from "@/components/admin-roadmaps-panel";
import { getRoadmapAdminSummary } from "@/lib/roadmap-admin-helpers";

// Live data — roadmap counts + per-client stats change on every task
// status flip the consultants make, so this page must not be cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "SEO Consultant Roadmaps — Wonder Ads Workspace",
};

export default async function AdminRoadmapsPage() {
  const summary = await getRoadmapAdminSummary();

  return (
    <PageShell>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Admin
      </Link>
      <AdminRoadmapsPanel summary={summary} />
    </PageShell>
  );
}
