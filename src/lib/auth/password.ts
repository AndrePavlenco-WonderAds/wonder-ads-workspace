// Password verification — Node-runtime only. Imported by the login
// API route (`/api/auth/login`), never by middleware (Edge runtime
// can't `require("node:crypto")` scrypt). The verify function is
// constant-time against the stored hash so an attacker can't time
// their way through the comparison.

import { scryptSync, timingSafeEqual } from "node:crypto";
import { findEmployeeByUsername } from "./credentials";

const KEY_LENGTH = 64;

/** Compute the scrypt hash for a plain password against the given
 *  salt. Pure helper — surfaced so a rotation script can reuse the
 *  exact same parameters as the seed-time hash. */
export function scryptHash(plain: string, saltHex: string): string {
  return scryptSync(plain, saltHex, KEY_LENGTH).toString("hex");
}

/** Verify the username + password against the credential table.
 *  Returns the canonical username (post-normalisation) on success,
 *  null on failure. We always run the scrypt computation even on an
 *  unknown username so the response time doesn't leak which users
 *  exist. */
export function verifyEmployeeLogin(
  usernameRaw: string,
  passwordRaw: string,
): string | null {
  const row = findEmployeeByUsername(usernameRaw);
  // Decoy: when the username doesn't exist, still run a scrypt against
  // a stable fake salt so the response timing matches a real lookup.
  // The decoy salt is a constant — same length as any real salt — so
  // the cost is identical. The trailing falsey return is the only
  // observable difference, and that's the same as a wrong-password.
  if (!row) {
    scryptSync(passwordRaw, "00000000000000000000000000000000", KEY_LENGTH);
    return null;
  }
  const expected = Buffer.from(row.hash, "hex");
  const got = scryptSync(passwordRaw, row.salt, KEY_LENGTH);
  if (expected.length !== got.length) return null;
  if (!timingSafeEqual(expected, got)) return null;
  return row.username;
}
