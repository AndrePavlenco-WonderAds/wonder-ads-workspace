// Os blocos da Documentação da empresa. Um bloco = um tema, com uma ou mais
// páginas.
// Cada um declara o seu público; o hub e as páginas leem daqui.

import { readerSees, type BlockAudience, type DocsReader } from "./access";

export type DocsPage = {
  /** Chave da página — o hub usa-a para mostrar o resumo vivo dela. */
  id: string;
  href: string;
  label: string;
  /** Uma linha: o que lá está. */
  hint: string;
};

export type DocsBlock = {
  id: string;
  title: string;
  /** Uma frase, sem floreados. */
  summary: string;
  audience: BlockAudience;
  /** Rótulo do público, para o cartão. */
  audienceLabel: string;
  updatedAt: string;
  pages: DocsPage[];
};

export const DOCS_BLOCKS: DocsBlock[] = [
  {
    id: "remuneracao-variavel",
    title: "Bónus & Comissões",
    summary: "O que ganhas além do salário: as regras, as contas e onde estás este mês.",
    audience: { depts: ["SEO"] },
    audienceLabel: "SEO DPT",
    updatedAt: "2026-10-26",
    pages: [
      {
        id: "bonus-nps",
        href: "/documentacao/bonus-nps",
        label: "Bónus NPS",
        hint: "Individual e de equipa, todos os meses",
      },
      {
        id: "comissoes",
        href: "/documentacao/comissoes",
        label: "Comissões",
        hint: "Renovações, cross-sells e upsells",
      },
    ],
  },
];

export function blocksFor(reader: DocsReader): DocsBlock[] {
  return DOCS_BLOCKS.filter((b) => readerSees(reader, b.audience));
}

export function getBlock(id: string): DocsBlock | null {
  return DOCS_BLOCKS.find((b) => b.id === id) ?? null;
}
