// Identity chip shown in the workspace header — "Manuel S. · SEO ▾"
// with a hover menu carrying the logout link. Server component: reads
// the HMAC-signed session cookie, resolves the username back to a
// display row via credentials.ts, and renders the pill. When there's
// no valid session (e.g. on /login itself, where the cookie is gone)
// it renders nothing — no orphan placeholder.
//
// O chip mostra sempre a pessoa que a app está a tratar como utilizador —
// a vista, quando há lente ativa. É o mesmo princípio do resto: a ver como
// outra pessoa, tudo tem de parecer o dela, senão a vista não prova nada.
// Quem fez login vai à parte, para o menu poder dizer de quem é a sessão e
// oferecer o caminho de volta.

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  effectiveUsername,
  readSession,
} from "@/lib/auth/session";
import {
  canEditDept,
  getEmployeeDisplay,
  isAdminUsername,
  listImpersonationTargets,
} from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";
import { UserChipMenu } from "./user-chip-menu";

export async function UserChip() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await readSession(cookieValue);
  if (!session) return null;
  const viewingUsername = effectiveUsername(session);
  const display = viewingUsername ? getEmployeeDisplay(viewingUsername) : null;
  if (!display) return null;
  // 1-week cookie — surface session age so consultants can see when
  // they'll be prompted again, without doing the maths themselves.
  // Show days when there's >1 day left, hours otherwise.
  const msLeft = Math.max(0, session.exp - Date.now());
  const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.round(msLeft / (60 * 60 * 1000));
  const expiresLabel =
    daysLeft >= 1
      ? `${daysLeft} day${daysLeft === 1 ? "" : "s"}`
      : `${hoursLeft}h`;

  // O seletor só existe para quem FEZ LOGIN como SuperAdmin — e continua a
  // existir enquanto ele está na pele de outra pessoa, para poder saltar
  // direto para uma terceira sem ter de voltar a si primeiro.
  const realIsAdmin = isAdminUsername(session.u);
  const realDisplay = getEmployeeDisplay(session.u);

  return (
    <UserChipMenu
      name={display.name}
      avatar={getTeamAvatar(viewingUsername)}
      role={display.role}
      dept={display.dept}
      isAdmin={display.isAdmin}
      // Quem edita SEO tem o estúdio de Weekly Reports no menu. Segue a
      // pessoa que está a ser VISTA, como o resto do chip: com lente ativa,
      // o menu tem de parecer o dela.
      canWeeklyReports={canEditDept(viewingUsername, "seo")}
      expiresLabel={expiresLabel}
      canImpersonate={realIsAdmin}
      realName={realDisplay?.name ?? session.u}
      viewingAs={session.as ?? null}
      people={
        realIsAdmin
          ? listImpersonationTargets().map((p) => ({
              ...p,
              avatar: getTeamAvatar(p.username),
            }))
          : []
      }
    />
  );
}
