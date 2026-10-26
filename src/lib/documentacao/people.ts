// Os consultores SEO que entram no bónus NPS e na escada de comissões — quem
// edita SEO e não é da direção nem viewer. Só campos de apresentação: isto
// chega a componentes e nunca leva material de password.

import "server-only";
import { EMPLOYEE_CREDENTIALS } from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";

export type DocsPerson = { username: string; name: string; avatar: string | null };

export function seoConsultants(): DocsPerson[] {
  return EMPLOYEE_CREDENTIALS.filter(
    (c) => c.dept === "SEO" && !c.isAdmin && !c.viewerOf && c.assignable !== false,
  ).map((c) => ({ username: c.username, name: c.name, avatar: getTeamAvatar(c.username) }));
}
