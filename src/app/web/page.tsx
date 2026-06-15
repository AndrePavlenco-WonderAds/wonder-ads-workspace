import Link from "next/link";
import { Code2, History } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { AccessDenied } from "@/components/access-denied";
import { WebBoard } from "@/components/web-board";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts, getWebAssignees } from "@/lib/auth/credentials";
import {
  getAllProjects,
  toPublicProject,
  webStorageConfigured,
} from "@/lib/web-projects-store";

export const metadata = {
  title: "WEB DPT — Wonder Ads Workspace",
};

// Always render fresh — the board reflects live KV state.
export const dynamic = "force-dynamic";

export default async function WebPage() {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return (
      <PageShell>
        <AccessDenied
          title="No Web access"
          description="The Web department is open to web designers, SEO consultants, and SuperAdmins. Ping Andre if you think you should have access."
          username={employee?.username}
        />
      </PageShell>
    );
  }

  const projects = webStorageConfigured ? await getAllProjects() : [];
  const assignees = getWebAssignees();

  return (
    <PageShell wide>
      <DepartmentHeader
        title="WEB DPT"
        tagline="The live project board for every website build — from negotiation to launch. Drag projects across the pipeline, track client feedback, and keep every asset and access credential in one place."
        Icon={Code2}
        rightSlot={
          <Link
            href="/web/activity"
            className="group inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/75 transition hover:border-white/30 hover:bg-white/[0.07] hover:text-white"
          >
            <History className="h-4 w-4" />
            Activity log
          </Link>
        }
      />

      <WebBoard
        initialProjects={projects.map(toPublicProject)}
        assignees={assignees}
        storageConfigured={webStorageConfigured}
      />
    </PageShell>
  );
}
