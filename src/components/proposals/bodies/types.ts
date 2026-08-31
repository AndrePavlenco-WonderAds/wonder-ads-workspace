import type { ReactNode } from "react";
import type { ProposalHero, ProposalNavItem } from "../proposal-document";

export type ProposalBodyProps = {
  consultantName: string;
  consultantEmail: string;
};

/** O que cada proposta entrega à página: navegação, hero e corpo. */
export type ProposalRender = {
  nav: ProposalNavItem[];
  hero: ProposalHero;
  Body: (props: ProposalBodyProps) => ReactNode;
};
