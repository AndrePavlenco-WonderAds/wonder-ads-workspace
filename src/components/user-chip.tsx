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
import {
  colorForNumber,
  dailyNumberFor,
  dailyRoster,
  describeDay,
  lisbonISODate,
} from "@/lib/seo-daily-number";
import { UserChipMenu, type DailyNumberView } from "./user-chip-menu";

/** «Manuel Silva» → «Manuel», «Fran. Rosa» → «Fran», «João B.» → «João». Na
 *  roda só há um André (o Pereira), por isso o primeiro nome chega. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0].replace(/\.$/, "");
}

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

  // «Número do dia» dos consultores SEO — resolvido aqui, no servidor, e
  // entregue ao chip já sem credenciais (número, cor, roda do dia com
  // primeiros nomes). Segue a pessoa VISTA, como o resto do chip: a ver
  // como o Manuel, o número é o do Manuel. Null para quem não está na roda
  // e ao fim de semana — o chip simplesmente não mostra o azulejo.
  const iso = lisbonISODate();
  const mine = dailyNumberFor(viewingUsername, iso);
  const day = describeDay(iso);
  const dailyNumber: DailyNumberView | null = mine
    ? {
        number: mine.number,
        hex: mine.color.hex,
        label: mine.color.label,
        day,
        weekday: day.split(",")[0],
        roster: (dailyRoster(iso) ?? []).map((r) => ({
          username: r.username,
          number: r.number,
          hex: colorForNumber(r.number).hex,
          name: firstName(getEmployeeDisplay(r.username)?.name ?? r.username),
          me: r.username === viewingUsername,
        })),
      }
    : null;

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
      dailyNumber={dailyNumber}
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
