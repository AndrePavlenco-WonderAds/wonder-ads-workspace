import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { WebProjectDetail } from "@/components/web-project-detail";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  accessibleDepts,
  editableDepts,
  getWebAssignees,
  webDeliveryRights,
} from "@/lib/auth/credentials";
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
      {/* Web só de leitura (v77.35): o fieldset desliga todos os campos e
          botões da ficha; o middleware recusa a escrita de qualquer forma. */}
      <fieldset
        disabled={!editableDepts(employee).includes("web")}
        className="m-0 min-w-0 border-0 p-0"
      >
        <WebProjectDetail
          initialProject={toPublicProject(project)}
          assignees={getWebAssignees()}
          currentUser={{ username: employee.username, name: employee.name }}
          deliveryRights={webDeliveryRights(employee)}
        />
      </fieldset>
    </PageShell>
  );
}
