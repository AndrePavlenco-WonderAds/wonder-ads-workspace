// Portão das rotas /api/admin/probation/*: só SuperAdmin. O middleware já
// exige sessão, recusa perfis viewer e bloqueia escritas com o «Ver como»
// ativo; isto é a segunda tranca, na própria rota — são dados de RH e não
// podem depender de a entrada do menu estar escondida. A ver como um
// consultor, `isAdmin` segue a pessoa vista e a porta fecha-se também.

import "server-only";
import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { probationConfigured } from "./store";

export type ProbationActor = { username: string; name: string };

/** Respostas destas rotas nunca ficam em cache nenhuma. */
export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function guardProbation(): Promise<
  { ok: true; actor: ProbationActor } | { ok: false; res: NextResponse }
> {
  const me = await getCurrentEmployee();
  if (!me) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: NO_STORE }),
    };
  }
  if (!me.isAdmin) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Os planos de probation são só para SuperAdmin." },
        { status: 403, headers: NO_STORE },
      ),
    };
  }
  if (!probationConfigured) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Armazenamento indisponível — KV não está configurado." },
        { status: 503, headers: NO_STORE },
      ),
    };
  }
  return { ok: true, actor: { username: me.username, name: me.name } };
}
