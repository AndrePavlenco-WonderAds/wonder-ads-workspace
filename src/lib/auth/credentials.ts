// Employee credential table for the workspace login gate.
//
// One row per employee allowed to log in. The username is the public
// identifier (slug-style, matches the seed-employee id wherever
// possible); the password is NOT stored — only a scrypt hash + per-row
// salt so a leak of this file doesn't leak passwords.
//
// To rotate a password, regenerate just that row's `salt` + `hash`
// with the same generator that produced them (Node `crypto.scryptSync(
// plain, salt, 64).toString("hex")` with a fresh 16-byte salt) and
// send the user the new plain text out-of-band. Plain passwords live
// only on Andre's desktop credentials file — never in this repo.

export type EmployeeCredential = {
  /** URL-safe identifier the user types into the login form. */
  username: string;
  /** Display name shown in the "Logged in as …" chip. */
  name: string;
  /** Role string — informational on the chip. SuperAdmin gating is
   *  driven by `isAdmin`, not this string. */
  role: string;
  /** Primary department. Informational only. */
  dept: string;
  /** When true, this user can enter the SuperAdmin Control Suite at
   *  `/admin`. Only Alex, Alice, and Andre have this flag; everyone
   *  else hits the Access Denied screen. */
  isAdmin?: boolean;
  /** Hex-encoded random salt — 16 bytes (32 hex chars). */
  salt: string;
  /** Hex-encoded scrypt output — N=16384 (Node default), r=8, p=1,
   *  keyLength=64 → 128 hex chars. */
  hash: string;
};

export const EMPLOYEE_CREDENTIALS: EmployeeCredential[] = [
  {
    username: "andre",
    name: "André Pavlenco",
    role: "Founder",
    dept: "All",
    isAdmin: true,
    salt: "32427320a730f1e0c239b069608d1529",
    hash: "fb4bd29d280ba7c431dba3310d640967fb4c12e8f6bfef67795dd1a76af76e6598899604e43d8495c6bb59e2b88be8e78a2bcfa433d807589969ce8f203fb349",
  },
  {
    username: "alex",
    name: "Alex",
    role: "SuperAdmin",
    dept: "All",
    isAdmin: true,
    salt: "38714f97f8304fa760c306cfebe7f111",
    hash: "247ed5439504afaf7ff9b63518f8ca7a0048543c54d9e50af74c0498af5be8de9f33aa417eb43671bc3b4c2380c0b3c4e112d6d9a51f2651bd06036dbca1499f",
  },
  {
    username: "alice",
    name: "Alice",
    role: "SuperAdmin",
    dept: "All",
    isAdmin: true,
    salt: "9463f577eb3171ce484b15cf83a00fa0",
    hash: "6f727c917b71c7d8fa1b3efde211183c8715fc82ec29653c0b2fd7f7c11a511af09668fd8aa76b5c7b48f87ee937867abe3e9d1de6badf0763b4255c073a65dc",
  },
  {
    username: "manuel-s",
    name: "Manuel S.",
    role: "SEO Consultant",
    dept: "SEO",
    salt: "336026cc21c409c4aebdfb8148c8d0a5",
    hash: "dfa50f7e60e4f1601e4f6d7c95be9847d63e8b63f354a46bab2b09446ab1b459b003b2f0199522a762b02c97ecc255d640b7877f3f2e7e61e3ad69b1fdeff050",
  },
  {
    username: "fran-r",
    name: "Fran. R.",
    role: "SEO Consultant",
    dept: "SEO",
    salt: "0fc7b7960beb67ac252a908ef770b6ed",
    hash: "6e007a432f6134a7ee4147089cb486461541cc1fa25a1d1cdf6e077447f4f1ea1962ca78114ad599e8dca4c3138a2dce5fef3f9dbbe189633e449b7c0b19071c",
  },
  {
    username: "yenisey-r",
    name: "Yenisey R.",
    role: "SEO Consultant",
    dept: "SEO",
    salt: "830074dc1e56d7cbaf74665b26467711",
    hash: "8ac86c5d9126362012ff5dedf8b7240c344ee4184967ab7fcf325ca4db77f0ac7063318d7cecf5ae8e1defd7836dcada185adb91ca49435ac984af81968cb691",
  },
  {
    username: "germano-c",
    name: "Germano C.",
    role: "ADS Consultant",
    dept: "ADS",
    salt: "bb6622826ccaefd1b6f0a9ba4283b69c",
    hash: "416eece1b238b1dd4175b548cfa7ada44f4c12343fe49191cbf6c73329b63ed960f32b94e5966156917504dfc04ad4af72cbc4b42e090a5678d991f895b6dcf6",
  },
];

/** Return the credential row for a username, normalised to lowercase
 *  + trimmed so trailing whitespace from a copy/paste doesn't lock
 *  someone out. */
export function findEmployeeByUsername(
  username: string,
): EmployeeCredential | null {
  const u = username.trim().toLowerCase();
  return EMPLOYEE_CREDENTIALS.find((c) => c.username === u) ?? null;
}

/** Lookup by username for the post-login session — used by PageShell
 *  to render the "Logged in as …" chip without hitting the password
 *  fields. Same normalisation as findEmployeeByUsername. */
export function getEmployeeDisplay(username: string): {
  name: string;
  role: string;
  dept: string;
  isAdmin: boolean;
} | null {
  const row = findEmployeeByUsername(username);
  return row
    ? {
        name: row.name,
        role: row.role,
        dept: row.dept,
        isAdmin: Boolean(row.isAdmin),
      }
    : null;
}

/** True when the username corresponds to one of the three SuperAdmin
 *  accounts (Alex / Alice / Andre). Source of truth for /admin gating. */
export function isAdminUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  const row = findEmployeeByUsername(username);
  return Boolean(row?.isAdmin);
}
