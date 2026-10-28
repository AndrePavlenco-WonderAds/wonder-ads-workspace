// Os blocos da Documentação da empresa. Um bloco = um tema, com uma ou mais
// páginas.
// Cada um declara o seu público; o hub e as páginas leem daqui.

import { readerSees, type BlockAudience, type DocsReader } from "./access";

export type DocsPage = {
  /** Chave da página — o hub usa-a para mostrar o resumo vivo dela. */
  id: string;
  href: string;
  label: string;
  /** Capa do cartão no hub, em public/ (gerada com o Gemini, 4:3). Sem
   *  capa, o hub mostra um painel provisório até ela ser gerada. */
  image?: string;
  /** Pastilha por baixo do título no hub (estilo da tag Growth). */
  tag?: string;
  /** Aviso de acesso restrito por baixo do título, com cadeado (v78.30). */
  restricted?: string;
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
    updatedAt: "2026-10-28",
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
  {
    id: "bonus-semestral",
    title: "Bónus semestral",
    // Toda a equipa: o bónus sai das ineficácias, que se aplicam a todos.
    audience: { depts: ["SEO", "ADS", "Web", "Commercial"] },
    audienceLabel: "toda a equipa",
    updatedAt: "2026-10-28",
    pages: [
      {
        id: "bonus-semestral",
        href: "/documentacao/bonus-semestral",
        label: "Bónus semestral",
        // Capa dada pelo André (2026-10-28).
        image: "/documentacao/bonus-semestral-capa.jpg",
        tag: "Empreender dentro da WonderAds",
      },
    ],
  },
  {
    id: "ineficacias",
    title: "Ineficácias & Probation",
    // Toda a equipa: as ineficácias e o probation aplicam-se a todos.
    audience: { depts: ["SEO", "ADS", "Web", "Commercial"] },
    audienceLabel: "toda a equipa",
    updatedAt: "2026-10-28",
    pages: [
      // As duas capas foram dadas pelo André (2026-10-27).
      { id: "ineficacias", href: "/documentacao/ineficacias", label: "Ineficácias", image: "/documentacao/ineficacias-capa.jpg" },
      { id: "probation", href: "/documentacao/probation", label: "Probation", image: "/documentacao/probation-capa.jpg" },
    ],
  },
  {
    id: "matriz-talento",
    title: "Matriz de Talento Wonder",
    // Só direção e treinadores (os buddies): é a grelha com que se avalia a
    // equipa. Fica em último, depois das ineficácias e do probation (v78.33).
    audience: { depts: [], tags: ["Treinador"] },
    audienceLabel: "Treinadores/Buddies",
    updatedAt: "2026-10-28",
    pages: [
      {
        id: "matriz-talento",
        href: "/documentacao/matriz-talento",
        label: "Matriz de Talento Wonder",
        image: "/documentacao/matriz-talento-capa.jpg",
        restricted: "Só para SuperAdmins e Treinadores/Buddies",
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
