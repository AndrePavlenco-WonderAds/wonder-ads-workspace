// SuperAdmin onboarding hub: start a client's onboarding (services → link),
// jump to the content editor, and see everyone currently being onboarded.
// Gated by the /admin layout (isAdmin).

import Link from "next/link";
import { ArrowLeft, ClipboardList, Pencil, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { NewOnboardingClient } from "@/components/new-onboarding-client";
import { CopyPublicLinkButton } from "@/components/copy-public-link-button";
import { DeleteOnboardingButton } from "@/components/delete-onboarding-button";
import { getOnboardingClients } from "@/lib/onboarding-clients-store";
import { servicesLabel } from "@/lib/onboarding-tracks";
import { formatDate } from "@/lib/dates";
import { prospectPeople } from "@/lib/prospects/access";
import { listProspectFiles } from "@/lib/prospects/store";
import { prospectCompleteness, prospectPath } from "@/lib/prospects/shared";

const OWNER_GROUP = ["Comercial", "Direção", "Consultores"];

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Onboarding — SuperAdmin Control Suite",
};

export default async function AdminOnboardingPage() {
  const clients = await getOnboardingClients();
  // Ficha do prospect (v80.0): quem pode ser comercial responsável, e quão
  // preenchida está a ficha de cada onboarding.
  const owners = prospectPeople()
    .filter((p) => p.canOwn)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "pt"))
    .map((p) => ({ username: p.username, name: p.name, group: OWNER_GROUP[p.rank] ?? "Equipa" }));
  const filePct = new Map(
    (await listProspectFiles()).map((f) => [f.slug, prospectCompleteness(f).pct] as const),
  );

  return (
    <PageShell wide>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        SuperAdmin Control Suite
      </Link>

      <div className="animate-fade-up mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Onboarding</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/55">
            Gera links de onboarding por serviço e acompanha os clientes em
            processo. Para editar as lições e o formulário, abre o editor.
          </p>
        </div>
        <Link
          href="/seo/onboarding-editor"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3.5 py-2 text-[13px] font-medium text-white/70 transition hover:border-[#783DF5]/40 hover:text-white"
        >
          <Pencil className="h-4 w-4" />
          Editar processo de onboarding
        </Link>
      </div>

      <div className="animate-fade-up mt-8">
        <NewOnboardingClient owners={owners} />
      </div>

      {/* Onboarding clients list */}
      <section className="animate-fade-up mt-8">
        <header className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
          <Users className="h-4 w-4" />
          Clientes em onboarding
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium tracking-normal text-white/60">
            {clients.length}
          </span>
        </header>

        {clients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
            Ainda não há clientes em onboarding. Cria o primeiro link acima.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {clients.map((c) => (
              <div
                key={c.slug}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-lg">
                  {c.icon ?? "🚀"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {c.title}
                  </p>
                  <p className="text-[11px] text-white/45">
                    {servicesLabel(c.services ?? [])}
                    {c.consultant ? ` · ${c.consultant}` : ""} · criado{" "}
                    {formatDate(c.createdAt)}
                  </p>
                </div>
                {c.promotedAt ? (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/80">
                    Formulário submetido
                  </span>
                ) : c.isNew ? (
                  <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
                    Novo
                  </span>
                ) : null}
                {/* Ficha do prospect (v80.0) — existe para todos os
                    onboardings; os de antes da v80 nascem na 1.ª escrita. */}
                <Link
                  href={prospectPath(c.slug)}
                  title="Ficha do prospect — interesses, prioridades, oportunidades e notas das reuniões"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#783DF5]/30 bg-[#783DF5]/[0.08] px-2.5 py-1.5 text-[11.5px] font-semibold text-violet-100 transition hover:border-[#783DF5]/55 hover:bg-[#783DF5]/[0.14]"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Ficha
                  <span className="tabular-nums text-violet-200/60">
                    {filePct.get(c.slug) ?? 0}%
                  </span>
                </Link>
                <CopyPublicLinkButton path={`/${c.slug}/onboarding`} />
                <DeleteOnboardingButton slug={c.slug} title={c.title} />
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
