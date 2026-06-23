import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { TicketDetail } from "@/components/ticket-detail";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts, getWebAssignees } from "@/lib/auth/credentials";
import { getTicket } from "@/lib/web-tickets-store";
import { ticketRef } from "@/lib/web-tickets-shared";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getCurrentEmployee();

  // The author of a ticket can always view it; Web-dept members + admins
  // can view any ticket. Anyone else is sent to Access Denied.
  const ticket = await getTicket(id);
  if (!employee) {
    return (
      <PageShell>
        <AccessDenied title="Inicia sessão" description="Sessão necessária." />
      </PageShell>
    );
  }
  if (!ticket) notFound();

  const hasWeb = accessibleDepts(employee).includes("web");
  if (!hasWeb && ticket.authorUsername !== employee.username) {
    return (
      <PageShell>
        <AccessDenied
          title="Sem acesso a este ticket"
          description="Só a equipa de Web ou o autor do ticket o podem ver."
          username={employee.username}
        />
      </PageShell>
    );
  }

  const assignees = getWebAssignees().map((a) => ({
    username: a.username,
    name: a.name,
  }));

  return (
    <PageShell wide>
      <header className="animate-fade-up mt-4">
        <Link
          href={hasWeb ? "/web/tickets" : "/"}
          className="inline-flex w-fit items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          {hasWeb ? "Tickets" : "Início"}
        </Link>
        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
          Ticket {ticketRef(ticket)}
        </p>
      </header>

      <section className="mt-4">
        <TicketDetail initialTicket={ticket} assignees={assignees} />
      </section>
    </PageShell>
  );
}
