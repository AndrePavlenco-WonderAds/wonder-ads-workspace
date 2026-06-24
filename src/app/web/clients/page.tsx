// Web Dept client registry — index / hub.
//
// Lists every client the team knows about: registered profiles first, plus
// any client name seen on a project or ticket that isn't a saved profile
// yet (so the registry is useful before it's fully populated). Each card
// links to the per-client hub at /web/clients/[slug].

import Link from "next/link";
import { ArrowLeft, FolderKanban, Ticket, UserRound, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import {
  getAllProjects,
  webStorageConfigured,
} from "@/lib/web-projects-store";
import { getAllTickets } from "@/lib/web-tickets-store";
import { getAllClients } from "@/lib/web-clients-store";
import { slugify } from "@/lib/web-shared";

export const metadata = {
  title: "Clientes — WEB DPT — Wonder Ads Workspace",
};

export const dynamic = "force-dynamic";

type Row = {
  slug: string;
  name: string;
  registered: boolean;
  defaultAssigneeName: string;
  projectCount: number;
  ticketCount: number;
};

export default async function WebClientsPage() {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return (
      <PageShell>
        <AccessDenied
          title="Sem acesso ao Web"
          description="A área de clientes do Web é para web designers, consultores de SEO e SuperAdmins."
          username={employee?.username}
        />
      </PageShell>
    );
  }

  const [clients, projects, tickets] = webStorageConfigured
    ? await Promise.all([getAllClients(), getAllProjects(), getAllTickets()])
    : [[], [], []];

  const bySlug = new Map<string, Row>();
  for (const c of clients) {
    bySlug.set(c.slug, {
      slug: c.slug,
      name: c.name,
      registered: true,
      defaultAssigneeName: c.defaultAssigneeName,
      projectCount: 0,
      ticketCount: 0,
    });
  }
  const ensure = (rawName: string, rawSlug?: string): Row | null => {
    const name = rawName.trim();
    if (!name) return null;
    const slug = rawSlug || slugify(name);
    if (!slug) return null;
    let row = bySlug.get(slug);
    if (!row) {
      row = {
        slug,
        name,
        registered: false,
        defaultAssigneeName: "",
        projectCount: 0,
        ticketCount: 0,
      };
      bySlug.set(slug, row);
    }
    return row;
  };
  for (const p of projects) {
    const row = ensure(p.clientName ?? "", p.clientSlug);
    if (row) row.projectCount += 1;
  }
  for (const t of tickets) {
    const row = ensure(t.project ?? "", t.clientSlug);
    if (row) row.ticketCount += 1;
  }

  const rows = Array.from(bySlug.values()).sort((a, b) => {
    // Registered first, then by name.
    if (a.registered !== b.registered) return a.registered ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <PageShell wide>
      <header className="animate-fade-up mt-4 flex flex-col gap-3">
        <Link
          href="/web"
          className="inline-flex w-fit items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          WEB DPT
        </Link>
        <div className="flex items-center gap-3">
          <span className="brand-gradient-bg flex h-11 w-11 items-center justify-center rounded-xl shadow-[0_8px_30px_-6px_rgba(120,61,245,0.6)]">
            <Users className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              <span className="brand-gradient-text">Clientes</span>
            </h1>
            <p className="mt-0.5 text-sm text-white/50">
              Registo central de cada cliente — acessos, branding e histórico
              num só sítio.
            </p>
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-white/12 bg-white/[0.02] p-8 text-center text-sm text-white/55">
          Ainda não há clientes. Quando criares um projeto e indicares o
          cliente, ele aparece aqui automaticamente.
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Link
              key={r.slug}
              href={`/web/clients/${r.slug}`}
              className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-white/70">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold text-white">
                      {r.name}
                    </h2>
                    {r.defaultAssigneeName && (
                      <p className="truncate text-[11.5px] text-white/45">
                        {r.defaultAssigneeName}
                      </p>
                    )}
                  </div>
                </div>
                {!r.registered && (
                  <span className="shrink-0 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-amber-100">
                    Perfil por completar
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11.5px] text-white/50">
                <span className="inline-flex items-center gap-1.5">
                  <FolderKanban className="h-3.5 w-3.5" />
                  {r.projectCount} projeto{r.projectCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5" />
                  {r.ticketCount} ticket{r.ticketCount === 1 ? "" : "s"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
