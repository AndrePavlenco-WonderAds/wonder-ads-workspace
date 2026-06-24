import Link from "next/link";
import { ArrowLeft, TicketPlus } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { TicketForm } from "@/components/ticket-form";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getWebAssignees } from "@/lib/auth/credentials";
import {
  getAllProjects,
  webStorageConfigured,
} from "@/lib/web-projects-store";
import { getAllClients } from "@/lib/web-clients-store";
import { slugify } from "@/lib/web-shared";
import type { RequestingDept } from "@/lib/web-tickets-shared";
import type { ClientOption } from "@/components/client-combobox";

export const metadata = {
  title: "Criar Ticket para Web — Wonder Ads Workspace",
};

export const dynamic = "force-dynamic";

/** Map an employee's home department to a requesting-dept default. Web /
 *  founders / unknown fall back to Administração. */
function deptToRequesting(dept: string): RequestingDept {
  switch (dept) {
    case "SEO":
      return "seo";
    case "ADS":
      return "ads";
    case "Commercial":
      return "commercial";
    default:
      return "administracao";
  }
}

export default async function NewTicketPage() {
  // Open to ANY logged-in employee — no Web-dept gate. The whole point is
  // that anyone can file a Web request without entering the department.
  const employee = await getCurrentEmployee();
  if (!employee) {
    return (
      <PageShell>
        <AccessDenied
          title="Inicia sessão"
          description="Precisas de ter sessão iniciada para criar um ticket."
        />
      </PageShell>
    );
  }

  const webDevs = getWebAssignees().map((a) => ({
    username: a.username,
    name: a.name,
  }));
  const [projects, registry] = webStorageConfigured
    ? await Promise.all([getAllProjects(), getAllClients()])
    : [[], []];

  // Registry profiles first, then any client name seen on a project that
  // isn't a saved profile yet — same merge as the project board.
  const clients: ClientOption[] = registry.map((c) => ({
    slug: c.slug,
    name: c.name,
    defaultAssigneeName: c.defaultAssigneeName || undefined,
    registered: true,
  }));
  const seen = new Set(registry.map((c) => c.slug));
  for (const p of projects) {
    const name = p.clientName?.trim();
    if (!name) continue;
    const slug = p.clientSlug || slugify(name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    clients.push({ slug, name, registered: false });
  }
  clients.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageShell>
      <header className="animate-fade-up mt-4 flex flex-col gap-3">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          Início
        </Link>
        <div className="flex items-center gap-3">
          <span className="brand-gradient-bg flex h-11 w-11 items-center justify-center rounded-xl shadow-[0_8px_30px_-6px_rgba(120,61,245,0.6)]">
            <TicketPlus className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="brand-gradient-text">DPT Web</span>
          </h1>
        </div>
      </header>

      <section className="mt-7">
        <TicketForm
          authorName={employee.name}
          defaultDept={deptToRequesting(employee.dept)}
          webDevs={webDevs}
          clients={clients}
        />
      </section>
    </PageShell>
  );
}
