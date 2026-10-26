// Os blocos do Playbook. Um bloco = um tema, com uma ou mais páginas.
// Cada um declara o seu público; o hub e as páginas leem daqui.

import { readerSees, type BlockAudience, type PlaybookReader } from "./access";

export type PlaybookPage = {
  href: string;
  label: string;
  /** Uma linha: o que lá está. */
  hint: string;
};

export type PlaybookBlock = {
  id: string;
  title: string;
  /** Uma frase, sem floreados. */
  summary: string;
  audience: BlockAudience;
  /** Rótulo do público, para o cartão. */
  audienceLabel: string;
  updatedAt: string;
  pages: PlaybookPage[];
};

export const PLAYBOOK_BLOCKS: PlaybookBlock[] = [
  {
    id: "remuneracao-variavel",
    title: "Bónus & Comissões",
    summary: "O que ganhas além do salário: as regras, as contas e onde estás este mês.",
    audience: { depts: ["SEO"] },
    audienceLabel: "SEO DPT",
    updatedAt: "2026-10-26",
    pages: [
      {
        href: "/playbook/bonus-nps",
        label: "Bónus NPS",
        hint: "Individual e de equipa · mensal",
      },
      {
        href: "/playbook/comissoes",
        label: "Comissões",
        hint: "Renovações, cross-sells e upsells",
      },
    ],
  },
];

export function blocksFor(reader: PlaybookReader): PlaybookBlock[] {
  return PLAYBOOK_BLOCKS.filter((b) => readerSees(reader, b.audience));
}

export function getBlock(id: string): PlaybookBlock | null {
  return PLAYBOOK_BLOCKS.find((b) => b.id === id) ?? null;
}
