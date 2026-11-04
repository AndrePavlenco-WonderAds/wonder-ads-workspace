// Quem abre a consola de acessos (v78.72): o André, por quem FEZ LOGIN e
// sem «Ver como». A página e a API chamam isto — o menu é só cosmética.

import "server-only";
import { getCurrentSession } from "@/lib/auth/server";
import { isImpersonating } from "@/lib/auth/session";
import { ACCESS_OWNER } from "./shared";

export async function accessConsoleUser(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session || session.u !== ACCESS_OWNER || isImpersonating(session)) return null;
  return session.u;
}
