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
import {
  getAllTickets,
  ticketsStorageConfigured,
} from "@/lib/web-tickets-store";
import { getAllClients } from "@/lib/web-clients-store";
import { TICKET_PRIORITY_META } from "@/lib/web-tickets-shared";
import { slugify } from "@/lib/web-shared";
import type { BoardTicket } from "@/components/web-board";
import type { ClientOption } from "@/components/client-combobox";

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

  // Client options for the create-project combobox: registered profiles
  // first, then any client name seen on a project that isn't registered
  // yet (so the picker is useful even before the registry is populated).
  const clients = webStorageConfigured ? await getAllClients() : [];
  const clientOptions: ClientOption[] = clients.map((c) => ({
    slug: c.slug,
    name: c.name,
    defaultAssigneeUsername: c.defaultAssigneeUsername || undefined,
    defaultAssigneeName: c.defaultAssigneeName || undefined,
    registered: true,
  }));
  const registeredSlugs = new Set(clients.map((c) => c.slug));
  for (const p of projects) {
    const nameTrimmed = p.clientName?.trim();
    if (!nameTrimmed) continue;
    const slug = p.clientSlug || slugify(nameTrimmed);
    if (registeredSlugs.has(slug)) continue;
    registeredSlugs.add(slug);
    clientOptions.push({ slug, name: nameTrimmed, registered: false });
  }
  clientOptions.sort((a, b) => a.name.localeCompare(b.name));

  // Tickets are first-class on the board, mapped onto its columns. We
  // surface everything except fully-closed (archived) tickets so the
  // team can drag them through the same Kanban as projects.
  const tickets = ticketsStorageConfigured ? await getAllTickets() : [];
  const openTickets: BoardTicket[] = tickets
    .filter((t) => t.status !== "closed")
    .map((t) => ({
      id: t.id,
      seq: t.seq,
      title: t.title,
      project: t.project,
      priorityLabel: TICKET_PRIORITY_META[t.priority].label,
      priorityTag: TICKET_PRIORITY_META[t.priority].tag,
      assigneeName: t.assigneeName,
      status: t.status,
    }));

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
        openTickets={openTickets}
        clientOptions={clientOptions}
      />
    </PageShell>
  );
}
