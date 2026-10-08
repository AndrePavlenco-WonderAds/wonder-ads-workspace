// Quem está do outro lado de um pedido a `/api/reviews` (v77.79).
//
// A API da tabela Pending Review é pública — o cliente edita-a pela página
// partilhada, sem sessão. Por isso a identidade não pode vir do corpo do
// pedido: vem do cookie de sessão, e só quando ele existe. Sem cookie é o
// cliente, e o cliente nunca fica carimbado em lado nenhum.
//
// Servidor apenas (lê cookies) — fica fora do review-store, que também é
// importado pelos componentes "use client" da tabela.

import { getCurrentSession } from "@/lib/auth/server";
import { effectiveUsername, isImpersonating } from "@/lib/auth/session";
import {
  getEmployeeDisplay,
  reviewTableAccess,
  type ReviewTableAccess,
} from "@/lib/auth/credentials";
import type { ReviewActor } from "@/lib/review-store";

export type ReviewRequester = {
  /** O utilizador da app a carimbar, ou null quando é o cliente. É sempre
   *  quem FEZ LOGIN — as escritas com «Ver como» são recusadas antes de
   *  chegarem ao store, por isso nunca se assina em nome de outra pessoa. */
  actor: ReviewActor | null;
  /** O que a pessoa vista pode fazer na consola interna (null = cliente ou
   *  alguém sem acesso à tabela). */
  access: ReviewTableAccess | null;
  /** Um SuperAdmin a ver a app como outra pessoa — só de leitura. */
  impersonating: boolean;
};

export async function getReviewRequester(): Promise<ReviewRequester> {
  const session = await getCurrentSession();
  if (!session) return { actor: null, access: null, impersonating: false };
  const real = getEmployeeDisplay(session.u);
  const effectiveName = effectiveUsername(session);
  const effective = effectiveName ? getEmployeeDisplay(effectiveName) : null;
  return {
    actor: real ? { username: session.u, name: real.name } : null,
    access: reviewTableAccess(effective),
    impersonating: isImpersonating(session),
  };
}

/** A resposta padrão para uma escrita feita com «Ver como». */
export const IMPERSONATION_WRITE_ERROR =
  "Estás a ver a app como outra pessoa — esta vista é só de leitura. Volta ao teu utilizador para fazer alterações.";
