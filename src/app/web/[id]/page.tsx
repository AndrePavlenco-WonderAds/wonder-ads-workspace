import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { WebProjectDetail } from "@/components/web-project-detail";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts, getWebAssignees } from "@/lib/auth/credentials";
import { getProject, toPublicProject } from "@/lib/web-projects-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  return {
    title: project
      ? `${project.name} — WEB DPT`
      : "Project — WEB DPT",
  };
}

export default async function WebProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return (
      <PageShell>
        <AccessDenied
          title="No Web access"
          description="The Web department is open to web designers, SEO consultants, and SuperAdmins."
          username={employee?.username}
        />
      </PageShell>
    );
  }

  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <PageShell wide backHref="/web" backLabel="Web board" sessionTimer>
      <WebProjectDetail
        initialProject={toPublicProject(project)}
        assignees={getWebAssignees()}
        currentUser={{ username: employee.username, name: employee.name }}
      />
    </PageShell>
  );
}
