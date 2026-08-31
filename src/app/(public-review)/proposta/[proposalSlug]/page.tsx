// Proposta comercial pública — /proposta/<slug>.
//
// Sem login e sem chrome interno, como as outras páginas para clientes do
// grupo (public-review): quem recebe o link (um cliente em renovação, um
// prospect) vê só a proposta. O conteúdo é código (ver src/lib/proposals),
// por isso a página é estática; um slug desconhecido dá 404 e nunca revela
// que outras propostas existem.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProposal, PROPOSALS } from "@/lib/proposals";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { getProposalRender } from "@/components/proposals/bodies";

export const dynamicParams = false;

export function generateStaticParams() {
  return PROPOSALS.map((p) => ({ proposalSlug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ proposalSlug: string }>;
}): Promise<Metadata> {
  const { proposalSlug } = await params;
  const meta = getProposal(proposalSlug);
  if (!meta) return { title: "Wonder Ads" };
  return {
    title: `${meta.clientName} + WonderAds | ${meta.title}`,
    description: meta.summary,
    robots: { index: false, follow: false },
  };
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ proposalSlug: string }>;
}) {
  const { proposalSlug } = await params;
  const meta = getProposal(proposalSlug);
  const render = getProposalRender(proposalSlug);
  if (!meta || !render) notFound();

  const clientLogo = meta.clientSlug ? getClientLogo(meta.clientSlug) : null;
  // O consultor vem do slug do cliente (a fonte que manda no resto da app);
  // o nome escrito nos metadados é a rede para prospects sem ficha.
  const consultantName = meta.clientSlug
    ? getConsultantForSlug(meta.clientSlug)
    : meta.consultant;
  const consultantEmail = meta.clientSlug
    ? getConsultantEmailForSlug(meta.clientSlug)
    : "info@wonder-ads.com";
  const { Body } = render;

  return (
    <ProposalDocument
      meta={meta}
      clientLogo={clientLogo}
      nav={render.nav}
      hero={render.hero}
      consultantName={consultantName === "Unassigned" ? meta.consultant : consultantName}
      consultantEmail={consultantEmail}
    >
      <Body consultantName={consultantName === "Unassigned" ? meta.consultant : consultantName} consultantEmail={consultantEmail} />
    </ProposalDocument>
  );
}
