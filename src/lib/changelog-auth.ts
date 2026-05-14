import { cookies } from "next/headers";

// The /changelog page is gated behind a superadmin password. The password
// itself lives in CHANGELOG_PASSWORD (defaults to "superadmin"); on a correct
// entry we store it back in an httpOnly cookie and compare against it.

export const CHANGELOG_COOKIE = "wa-changelog";

export const CHANGELOG_PASSWORD =
  process.env.CHANGELOG_PASSWORD || "superadmin";

/** True when the current request carries a valid changelog auth cookie. */
export async function isChangelogUnlocked(): Promise<boolean> {
  const store = await cookies();
  return store.get(CHANGELOG_COOKIE)?.value === CHANGELOG_PASSWORD;
}
