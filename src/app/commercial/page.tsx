import Link from "next/link";
import { ExternalLink, FileSignature, Handshake } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { CopyPublicLinkButton } from "@/components/copy-public-link-button";
import { LogoChip } from "@/components/logo-chip";
import { getClientLogo } from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import { formatDate } from "@/lib/dates";
import {
  KIND_LABEL,
  STATUS_LABEL,
  listProposals,
  proposalPath,
  type ProposalStatus,
} from "@/lib/proposals";

export const metadata = {
  title: "COMMERCIAL DPT — Wonder Ads Workspace",
};

// Cor do estado da proposta — verde quando fechou, âmbar enquanto espera.
const STATUS_CLASS: Record<ProposalStatus, string> = {
  rascunho: "border-white/15 bg-white/5 text-white/55",
  enviada: "border-amber-300/40 bg-amber-400/10 text-amber-100",
  aceite: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
  recusada: "border-rose-300/40 bg-rose-400/10 text-rose-100",
};

export default function CommercialPage() {
  const proposals = listProposals();
  return (
    <PageShell>
      <DepartmentHeader
        title="COMMERCIAL DPT"
        tagline="Sales pipeline, partnerships and client success. Lead flow, accounts, contracts and ongoing client work all live here."
        Icon={Handshake}
        count={proposals.length}
        countLabel={proposals.length === 1 ? "proposta" : "propostas"}
      />

      {/* ----- Propostas ----- */}
      <section id="propostas" className="animate-fade-up mt-12 scroll-mt-8 sm:mt-16">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Propostas
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Propostas comerciais
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Cada proposta é uma página pública em{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">/proposta/&lt;slug&gt;</code>
              {" "}— sem login, para enviar ao cliente ou ao prospect. O conteúdo vive em código
              (<code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">src/lib/proposals</code>), por isso fica versionado.
            </p>
          </div>
        </div>

        <ul className="space-y-3">
          {proposals.map((p) => {
            const logo = p.clientSlug ? getClientLogo(p.clientSlug) : null;
            const gradient = p.clientSlug
              ? paletteToGradient(getClientPalette(p.clientSlug))
              : undefined;
            const href = proposalPath(p.slug);
            return (
              <li
                key={p.slug}
                className="brand-gradient-border rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="shrink-0">
                      <LogoChip
                        logo={logo}
                        emoji={null}
                        alt={`${p.clientName} logo`}
                        gradient={gradient ?? "var(--brand-gradient)"}
                        size="lg"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/70">
                          <FileSignature className="h-3 w-3" />
                          {KIND_LABEL[p.kind]}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${STATUS_CLASS[p.status]}`}
                        >
                          {STATUS_LABEL[p.status]}
                        </span>
                        <span className="text-[11px] text-white/40">{formatDate(p.date)}</span>
                      </div>
                      <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-white">
                        {p.clientSlug ? (
                          <Link href={`/seo/${p.clientSlug}`} className="hover:underline">
                            {p.clientName}
                          </Link>
                        ) : (
                          p.clientName
                        )}
                        <span className="text-white/35"> · </span>
                        <span className="text-white/80">{p.title}</span>
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-white/60">{p.summary}</p>
                      <p className="mt-2 text-[12px] text-white/45">
                        {p.period} · {p.investment} · {p.consultant}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                    >
                      Abrir proposta
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <CopyPublicLinkButton path={href} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="animate-fade-up mt-10 sm:mt-14">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">
            Em construção
          </p>
          <p className="mt-3 max-w-xl text-base text-white/60">
            Pipeline, contas e contratos vão viver aqui. Por agora, o departamento
            guarda as propostas publicadas.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
