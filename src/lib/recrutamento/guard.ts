// Recrutamento (v80.13) — quem entra: os SuperAdmins. A página e as APIs
// verificam elas próprias (o layout do /admin não é fronteira de segurança).
// `by` é sempre quem FEZ LOGIN; com «Ver como» o middleware já recusa escritas.

import "server-only";
import { getCurrentSession } from "@/lib/auth/server";
import { effectiveUsername } from "@/lib/auth/session";
import { isAdminUsername } from "@/lib/auth/credentials";

export async function recruitmentUser(): Promise<{ username: string } | null> {
  const session = await getCurrentSession();
  const viewing = effectiveUsername(session);
  if (!session || !viewing || !isAdminUsername(viewing)) return null;
  return { username: session.u };
}
