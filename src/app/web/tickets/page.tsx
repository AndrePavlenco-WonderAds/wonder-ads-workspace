import Link from "next/link";
import { ArrowLeft, Plus, Ticket } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { TicketsBoard } from "@/components/tickets-board";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts, getWebAssignees } from "@/lib/auth/credentials";
import {
  computeStats,
  getAllTickets,
  ticketsStorageConfigured,
} from "@/lib/web-tickets-store";

export const metadata = {
  title: "Tickets — WEB DPT — Wonder Ads Workspace",
};

export const dynamic = "force-dynamic";

export default async function WebTicketsPage() {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return (
      <PageShell>
        <AccessDenied
          title="Sem acesso ao Web"
          description="A gestão de tickets é da equipa de Web e dos SuperAdmins."
          username={employee?.username}
        />
      </PageShell>
    );
  }

  const tickets = ticketsStorageConfigured ? await getAllTickets() : [];
  const stats = computeStats(tickets);
  const assignees = getWebAssignees().map((a) => ({
    username: a.username,
    name: a.name,
  }));

  return (
    <PageShell wide>
      <header className="animate-fade-up mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="brand-gradient-bg flex h-11 w-11 items-center justify-center rounded-xl shadow-[0_8px_30px_-6px_rgba(120,61,245,0.6)]">
            <Ticket className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
              <Link
                href="/web"
                className="inline-flex items-center gap-1 transition hover:text-white"
              >
                <ArrowLeft className="h-3 w-3" />
                WEB DPT
              </Link>
              <span className="text-white/25">·</span>
              <span>Tickets</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              <span className="brand-gradient-text">Gestão de Tickets</span>
            </h1>
          </div>
        </div>
        <Link
          href="/web/tickets/new"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110"
          style={{
            background:
              "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
          }}
        >
          <Plus className="h-4 w-4" />
          Novo ticket
        </Link>
      </header>

      <section className="mt-6">
        {!ticketsStorageConfigured ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-sm text-white/55">
            Armazenamento KV não configurado neste ambiente.
          </div>
        ) : (
          <TicketsBoard
            initialTickets={tickets}
            initialStats={stats}
            assignees={assignees}
          />
        )}
      </section>
    </PageShell>
  );
}
