import { cookies } from "next/headers";

// The /admin Admin Control Panel is gated behind a superadmin password.
// Mirrors the changelog-auth pattern but uses its own cookie + env var
// so the two gates stay independent — unlocking the changelog does not
// unlock admin and vice-versa.
//
// Default password is `superadmin` (per spec). Override in production
// by setting ADMIN_PASSWORD in the Vercel project env.

export const ADMIN_COOKIE = "wa-admin";

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "superadmin";

/** True when the current request carries a valid admin auth cookie. */
export async function isAdminUnlocked(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === ADMIN_PASSWORD;
}
