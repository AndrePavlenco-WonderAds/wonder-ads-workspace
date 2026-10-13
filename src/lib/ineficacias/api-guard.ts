// Portões das rotas de Ineficácias. O middleware já exige sessão, recusa
// perfis viewer e bloqueia escritas com o «Ver como» ativo; isto é a
// segunda tranca, na própria rota — são dados de RH e não podem depender de
// uma entrada de menu escondida.

import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentEmployee, getImpersonation, isRealUserAdmin } from "@/lib/auth/server";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { ineficaciasAvailable } from "./access";
import { ineficaciasConfigured } from "./store";

export type Actor = { username: string; name: string; role: string; dept: string };

/** Respostas destas rotas nunca ficam em cache nenhuma. */
export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function fail(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/** Só SuperAdmin (a pessoa VISTA — a ver como um consultor, a porta
 *  fecha-se também). */
export async function guardAdmin(): Promise<{ ok: true; actor: Actor } | { ok: false; res: NextResponse }> {
  const me = await getCurrentEmployee();
  if (!me) return { ok: false, res: fail("Sessão inválida.", 401) };
  if (!me.isAdmin) return { ok: false, res: fail("As ineficácias da equipa são só para a direção.", 403) };
  if (!ineficaciasConfigured) return { ok: false, res: fail("Armazenamento indisponível — KV não está configurado.", 503) };
  return { ok: true, actor: { username: me.username, name: me.name, role: me.role, dept: me.dept } };
}

/** O consultor a submeter o SEU relatório: sessão própria (sem lente), módulo
 *  aberto para ele, KV configurado. Devolve também o nome completo registado
 *  na conta — a assinatura valida-se contra ele. */
export async function guardConsultantWrite(): Promise<
  { ok: true; actor: Actor; fullName: string } | { ok: false; res: NextResponse }
> {
  const me = await getCurrentEmployee();
  if (!me) return { ok: false, res: fail("Sessão inválida.", 401) };
  if (me.viewerOf) return { ok: false, res: fail("Este perfil não tem acesso a esta área.", 403) };
  // Falha FECHADA: se a leitura da lente rebentar, trata-se como lente ativa.
  if (await getImpersonation().catch(() => ({ failed: true }))) {
    return { ok: false, res: fail("A ver como outra pessoa — o relatório é só do próprio.", 403) };
  }
  if (!ineficaciasAvailable(await isRealUserAdmin())) {
    return { ok: false, res: fail("As ineficácias ainda estão em construção.", 403) };
  }
  if (!ineficaciasConfigured) return { ok: false, res: fail("Armazenamento indisponível.", 503) };
  const row = findEmployeeByUsername(me.username);
  return {
    ok: true,
    actor: { username: me.username, name: me.name, role: me.role, dept: me.dept },
    fullName: row?.fullName ?? me.name,
  };
}

/** O IP e o user-agent do pedido — ficam na assinatura. Na Vercel o IP vem
 *  em `x-forwarded-for` (o primeiro da lista é o do cliente). */
export async function requestFingerprint(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const xff = h.get("x-forwarded-for") ?? "";
  const ip = (xff.split(",")[0] || h.get("x-real-ip") || "").trim() || "desconhecido";
  const userAgent = (h.get("user-agent") ?? "").slice(0, 400) || "desconhecido";
  return { ip, userAgent };
}
