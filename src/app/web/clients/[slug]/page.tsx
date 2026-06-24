// Per-client hub. Centralises everything for one client: the editable
// profile + vault (WebClientDetail) on the left, and every project and
// ticket that belongs to this client (joined by slug) on the right.
//
// Works even before the client is a saved profile: if no record exists we
// synthesise an empty one from the name seen on its projects/tickets, so
// the page is the place you go to *create* the profile too.

import Link from "next/link";
import { ArrowLeft, FolderKanban, Ticket } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { WebClientDetail } from "@/components/web-client-detail";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts, getWebAssignees } from "@/lib/auth/credentials";
import {
  getAllProjects,
  webStorageConfigured,
} from "@/lib/web-projects-store";
import { getAllTickets } from "@/lib/web-tickets-store";
import { getClient, toPublicClient } from "@/lib/web-clients-store";
import {
  WEB_STATUS_META,
  slugify,
  type PublicWebClient,
} from "@/lib/web-shared";
import {
  TICKET_PRIORITY_META,
  TICKET_STATUS_META,
} from "@/lib/web-tickets-shared";

export const dynamic = "force-dynamic";

function emptyClient(slug: string, name: string): PublicWebClient {
  return {
    slug,
    name,
    defaultAssigneeUsername: "",
    defaultAssigneeName: "",
    assets: {
      notes: "",
      dos: [],
      donts: [],
      brandingFiles: [],
      onboardingFiles: [],
      files: [],
      credentials: [],
      resources: [],
    },
    createdAt: 0,
    updatedAt: 0,
  };
}

export default async function WebClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const [record, projects, tickets] = webStorageConfigured
    ? await Promise.all([getClient(slug), getAllProjects(), getAllTickets()])
    : [null, [], []];

  const clientProjects = projects.filter(
    (p) => (p.clientSlug || slugify(p.clientName ?? "")) === slug,
  );
  const clientTickets = tickets.filter(
    (t) => (t.clientSlug || slugify(t.project ?? "")) === slug,
  );

  // Resolve a display name even when there's no saved profile yet.
  const derivedName =
    record?.name ||
    clientProjects[0]?.clientName?.trim() ||
    clientTickets[0]?.project?.trim() ||
    slug;

  const client = record ? toPublicClient(record) : emptyClient(slug, derivedName);
  const assignees = getWebAssignees().map((a) => ({
    username: a.username,
    name: a.name,
  }));

  return (
    <PageShell wide>
      <header className="animate-fade-up mt-4 flex flex-col gap-3">
        <Link
          href="/web/clients"
          className="inline-flex w-fit items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          Clientes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {client.name}
        </h1>
      </header>

      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT: editable profile + vault */}
        <WebClientDetail
          initialClient={client}
          registered={Boolean(record)}
          assignees={assignees}
        />

        {/* RIGHT: everything tied to this client */}
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="mb-3 inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
              <FolderKanban className="h-4 w-4 text-[color:var(--brand-magenta)]" />
              Projetos ({clientProjects.length})
            </h2>
            {clientProjects.length === 0 ? (
              <p className="text-sm text-white/40">Sem projetos para já.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {clientProjects.map((p) => {
                  const meta = WEB_STATUS_META[p.status];
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/web/${p.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/25 hover:bg-white/[0.05]"
                      >
                        <span className="truncate text-[13px] font-medium text-white">
                          {p.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-medium ${meta.tag}`}
                        >
                          {meta.short}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="mb-3 inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
              <Ticket className="h-4 w-4 text-[color:var(--brand-magenta)]" />
              Tickets ({clientTickets.length})
            </h2>
            {clientTickets.length === 0 ? (
              <p className="text-sm text-white/40">Sem tickets para já.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {clientTickets.map((t) => {
                  const sMeta = TICKET_STATUS_META[t.status];
                  const pMeta = TICKET_PRIORITY_META[t.priority];
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/web/tickets/${t.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/25 hover:bg-white/[0.05]"
                      >
                        <span className="min-w-0 truncate text-[13px] font-medium text-white">
                          <span className="text-white/40">#{t.seq}</span>{" "}
                          {t.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span title={pMeta.label}>{pMeta.emoji}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9.5px] font-medium ${sMeta.tag}`}
                          >
                            {sMeta.label}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
