// Os blocos da Documentação da empresa. Um bloco = um tema, com uma ou mais
// páginas.
// Cada um declara o seu público; o hub e as páginas leem daqui.

import { readerSees, type BlockAudience, type DocsReader } from "./access";

export type DocsPage = {
  /** Chave da página — o hub usa-a para mostrar o resumo vivo dela. */
  id: string;
  href: string;
  label: string;
  /** Capa do cartão no hub, em public/ (gerada com o Gemini, 4:3). */
  image: string;
  /** Pastilha por baixo do título no hub (estilo da tag Growth). */
  tag?: string;
};

export type DocsBlock = {
  id: string;
  title: string;
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
    audience: { depts: ["SEO"] },
    audienceLabel: "SEO DPT",
    updatedAt: "2026-10-26",
    pages: [
      {
        id: "bonus-nps",
        href: "/documentacao/bonus-nps",
        label: "Bónus NPS",
        image: "/documentacao/bonus-nps.jpg",
        tag: "Empreender dentro da WonderAds",
      },
      {
        id: "comissoes",
        href: "/documentacao/comissoes",
        label: "Comissões",
        image: "/documentacao/comissoes-percent.jpg",
        tag: "Empreender dentro da WonderAds",
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
