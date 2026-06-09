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
  return (
    <UserChipMenu
      name={display.name}
      role={display.role}
      dept={display.dept}
      expiresLabel={expiresLabel}
    />
  );
}
