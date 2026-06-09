// Identity chip shown in the workspace header — "Manuel S. · SEO ▾"
// with a hover menu carrying the logout link. Server component: reads
// the HMAC-signed session cookie, resolves the username back to a
// display row via credentials.ts, and renders the pill. When there's
// no valid session (e.g. on /login itself, where the cookie is gone)
// it renders nothing — no orphan placeholder.

import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/auth/session";
import { getEmployeeDisplay } from "@/lib/auth/credentials";
import { UserChipMenu } from "./user-chip-menu";

export async function UserChip() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await readSession(cookieValue);
  if (!session) return null;
  const display = getEmployeeDisplay(session.u);
  if (!display) return null;
  // 48h cookie — surface session age so consultants can see when
  // they'll be prompted again, without doing the maths themselves.
  const hoursLeft = Math.max(
    0,
    Math.round((session.exp - Date.now()) / (60 * 60 * 1000)),
  );
  return (
    <UserChipMenu
      name={display.name}
      role={display.role}
      dept={display.dept}
      hoursLeft={hoursLeft}
    />
  );
}
