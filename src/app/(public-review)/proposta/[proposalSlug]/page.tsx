// Proposta comercial pública — /proposta/<slug>.
//
// Sem login e sem chrome interno, como as outras páginas para clientes do
// grupo (public-review): quem recebe o link (um cliente em renovação, um
// prospect) vê só a proposta. Um slug desconhecido dá 404 e nunca revela
// que outras propostas existem.
//
// v77.12: há duas origens. As propostas em CÓDIGO (src/lib/proposals +
// bodies/<slug>.tsx) renderizam o corpo em React; as carregadas em PDF pelo
// Comercial (KV) mostram o documento embebido na mesma moldura clara. Por
// isso a página é dinâmica: o KV é consultado a cada pedido.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProposal } from "@/lib/proposals";
import { getProposalRecord } from "@/lib/proposals/store";
import { getClientLogo } from "@/lib/client-meta";
import { getConsultantEmailForSlug, getConsultantForSlug } from "@/lib/client-overrides";
import { resolveProposalConsultant } from "@/lib/proposals/consultant";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { ProposalPdfDocument } from "@/components/proposals/proposal-pdf-document";
import { getProposalRender } from "@/components/proposals/bodies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ proposalSlug: string }>;
}): Promise<Metadata> {
  const { proposalSlug } = await params;
  const meta = getProposal(proposalSlug) ?? (await getProposalRecord(proposalSlug));
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
  const record = await getProposalRecord(proposalSlug);
  if (!record) notFound();

  const clientLogo = record.clientSlug ? getClientLogo(record.clientSlug) : null;

  // ---- Proposta carregada em PDF ----
  if (record.source === "upload") {
    if (!record.file) notFound();
    const c = resolveProposalConsultant({
      clientSlug: record.clientSlug,
      consultant: record.consultant,
      consultantUsername: record.consultantUsername,
    });
    return (
      <ProposalPdfDocument
        meta={record}
        file={record.file}
        clientLogo={clientLogo}
        consultantName={c.name}
        consultantEmail={c.email}
      />
    );
  }

  // ---- Proposta em código ----
  const meta = getProposal(proposalSlug);
  const render = getProposalRender(proposalSlug);
  if (!meta || !render) notFound();

  // O consultor vem do slug do cliente (a fonte que manda no resto da app);
  // o nome escrito nos metadados é a rede para prospects sem ficha.
  const consultantName = meta.clientSlug
    ? getConsultantForSlug(meta.clientSlug)
    : meta.consultant;
  const consultantEmail = meta.clientSlug
    ? getConsultantEmailForSlug(meta.clientSlug)
    : "info@wonder-ads.com";
  const { Body } = render;
  const name = consultantName === "Unassigned" ? meta.consultant : consultantName;
  // O tipo editado no Comercial (KV) manda sobre o registo em código.
  const liveMeta = { ...meta, kind: record.kind, status: record.status };

  return (
    <ProposalDocument
      meta={liveMeta}
      clientLogo={clientLogo}
      nav={render.nav}
      hero={render.hero}
      consultantName={name}
      consultantEmail={consultantEmail}
    >
      <Body consultantName={name} consultantEmail={consultantEmail} />
    </ProposalDocument>
  );
}
