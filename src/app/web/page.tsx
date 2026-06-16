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
        tagline="Departamento Web Design & Development. Agência #1 de SEO em Lisboa"
      />

      <WebBoard
        initialProjects={projects.map(toPublicProject)}
        assignees={assignees}
        storageConfigured={webStorageConfigured}
      />
    </PageShell>
  );
}
