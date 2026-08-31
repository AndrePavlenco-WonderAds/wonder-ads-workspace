// Mapa slug → corpo da proposta. Cada proposta nova acrescenta uma entrada
// aqui e outra em `src/lib/proposals` (metadados). Fica separado do registo
// de metadados de propósito: este ficheiro puxa React, aquele não — e o
// departamento Comercial só precisa dos metadados para listar.

import type { ProposalRender } from "./types";
import { FISIO_RESTELO_RENOVACAO } from "./fisio-restelo-renovacao";

const BODIES: Record<string, ProposalRender> = {
  "fisio-restelo-renovacao": FISIO_RESTELO_RENOVACAO,
};

export function getProposalRender(slug: string): ProposalRender | null {
  return BODIES[slug] ?? null;
}
