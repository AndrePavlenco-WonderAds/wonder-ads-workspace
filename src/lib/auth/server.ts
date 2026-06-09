// Server-only auth helpers — give pages + API routes a clean way to
// answer "who is logged in" and "are they a SuperAdmin" without each
// caller re-implementing the cookie read.
//
// Designed for Node-runtime callers (server components + route handlers
// that don't run in Edge). Middleware reads the session directly via
// session.ts/readSession() so it stays Edge-compatible.

import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession, type SessionPayload } from "./session";
import {
  getEmployeeDisplay,
  isAdminUsername,
  type EmployeeCredential,
} from "./credentials";

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export async function getCurrentEmployee(): Promise<
  | (Pick<EmployeeCredential, "username" | "name" | "role" | "dept"> & {
      isAdmin: boolean;
    })
  | null
> {
  const session = await getCurrentSession();
  if (!session) return null;
  const display = getEmployeeDisplay(session.u);
  return display ? { username: session.u, ...display } : null;
}

/** True when the request carries a valid session whose username has
 *  the `isAdmin` flag. Replaces the old `superadmin`-password gate. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const session = await getCurrentSession();
  return isAdminUsername(session?.u);
}
