// Propostas comerciais — o registo das propostas publicadas no workspace.
//
// PORQUE VIVE AQUI E NÃO NO KV: uma proposta é um documento de venda, com
// texto trabalhado à mão, números fechados e uma data. Não é um registo que
// se edita num formulário — é código, revisto e versionado no git como o
// resto do site. Cada proposta tem uma entrada de metadados neste ficheiro
// (para listar, ligar e pesquisar) e um corpo em React em
// `src/components/proposals/bodies/<slug>.tsx` (o conteúdo em si).
//
// O URL público é /proposta/<slug> — fora do matcher do middleware, tal
// como as outras páginas para clientes: quem recebe o link abre sem login.
// Substitui os links do antigo proposals.wonder-ads.com (GoHighLevel), que
// não deixavam reaproveitar dados do workspace nem versionar o texto.

export type ProposalKind = "renovacao" | "nova";
export type ProposalStatus = "rascunho" | "enviada" | "aceite" | "recusada";

export type ProposalMeta = {
  /** Segmento do URL: /proposta/<slug>. */
  slug: string;
  /** Slug do cliente no workspace (null para prospects sem ficha). */
  clientSlug: string | null;
  clientName: string;
  /** Título curto — o que aparece na lista e no separador do browser. */
  title: string;
  kind: ProposalKind;
  status: ProposalStatus;
  /** ISO yyyy-mm-dd — a data da proposta. */
  date: string;
  /** Período contratual a que a proposta se refere. */
  period: string;
  /** Quem acompanha a conta / assina a proposta. */
  consultant: string;
  /** Uma frase para a lista do departamento Comercial. */
  summary: string;
  /** Investimento, tal como aparece no cartão de preço. */
  investment: string;
};

export const PROPOSALS: ProposalMeta[] = [
  {
    slug: "fisio-restelo-renovacao",
    clientSlug: "fisio-restelo",
    clientName: "Fisio Restelo",
    title: "Proposta de Renovação · Set 2026 – Fev 2027",
    kind: "renovacao",
    status: "enviada",
    date: "2026-08-31",
    period: "Setembro 2026 – Fevereiro 2027",
    consultant: "Fran. Rosa",
    summary:
      "Resultados dos primeiros 6 meses (fev–ago 2026), roadmap SEO + IA dos próximos 6, foco escoliose no Top 1–3 e CRM incluído.",
    investment: "4.500 € / 6 meses",
  },
];

export const KIND_LABEL: Record<ProposalKind, string> = {
  renovacao: "Renovação",
  nova: "Nova proposta",
};

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceite: "Aceite",
  recusada: "Recusada",
};

export function proposalPath(slug: string): string {
  return `/proposta/${slug}`;
}

export function getProposal(slug: string): ProposalMeta | null {
  return PROPOSALS.find((p) => p.slug === slug) ?? null;
}

/** Todas as propostas, da mais recente para a mais antiga. */
export function listProposals(): ProposalMeta[] {
  return [...PROPOSALS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getProposalsForClient(clientSlug: string): ProposalMeta[] {
  return listProposals().filter((p) => p.clientSlug === clientSlug);
}
