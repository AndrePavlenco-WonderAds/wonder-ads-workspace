// Portão das rotas /api/commercial/*: sessão, direito de EDITAR o
// departamento Comercial, e KV a funcionar. O middleware já exige sessão e
// já rejeita escritas de quem só pode ver; isto é a segunda tranca, na
// própria rota, para não depender de nenhum botão estar escondido.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { canEditDept } from "@/lib/auth/credentials";
import { proposalsStoreConfigured } from "./store";

export type CommercialActor = { username: string; name: string; isAdmin: boolean };

export async function guardCommercialWrite(): Promise<
  { ok: true; actor: CommercialActor } | { ok: false; res: NextResponse }
> {
  const me = await getCurrentEmployee();
  if (!me || !canEditDept(me.username, "commercial")) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Sem permissão para alterar propostas no departamento Comercial." },
        { status: 403 },
      ),
    };
  }
  if (!proposalsStoreConfigured) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Armazenamento indisponível — KV não está configurado." },
        { status: 503 },
      ),
    };
  }
  return { ok: true, actor: { username: me.username, name: me.name, isAdmin: me.isAdmin } };
}
