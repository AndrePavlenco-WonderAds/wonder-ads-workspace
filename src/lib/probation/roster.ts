// A lista de onde se escolhe o consultor de um plano: o roster da app
// (credentials.ts), sem os SuperAdmins — quem decide o plano não está nele.

import "server-only";
import { listImpersonationTargets } from "@/lib/auth/credentials";
import type { RosterPerson } from "@/components/probation/probation-editor";

export function probationRoster(): RosterPerson[] {
  return listImpersonationTargets()
    .filter((p) => !p.isAdmin)
    .map((p) => ({ username: p.username, name: p.name, role: p.role, dept: p.dept }));
}
