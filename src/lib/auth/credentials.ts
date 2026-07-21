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
  /** Full name as it appears in Slack (e.g. "Mike Nobre"). Used to build
   *  `@mentions` in the Web Dept Generate-Backlog output. Falls back to
   *  `name` when absent. */
  fullName?: string;
};

export const EMPLOYEE_CREDENTIALS: EmployeeCredential[] = [
  {
    username: "andre",
    name: "André Pavlenco",
    fullName: "André Pavlenco",
    role: "Founder",
    dept: "All",
    isAdmin: true,
    salt: "32427320a730f1e0c239b069608d1529",
    hash: "fb4bd29d280ba7c431dba3310d640967fb4c12e8f6bfef67795dd1a76af76e6598899604e43d8495c6bb59e2b88be8e78a2bcfa433d807589969ce8f203fb349",
  },
  {
    username: "alex",
    name: "Alex",
    fullName: "Alex",
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
    name: "Manuel Silva",
    role: "SEO Consultant",
    dept: "SEO",
    salt: "336026cc21c409c4aebdfb8148c8d0a5",
    hash: "dfa50f7e60e4f1601e4f6d7c95be9847d63e8b63f354a46bab2b09446ab1b459b003b2f0199522a762b02c97ecc255d640b7877f3f2e7e61e3ad69b1fdeff050",
  },
  {
    username: "fran-r",
    name: "Fran. Rosa",
    role: "SEO Consultant",
    dept: "SEO",
    salt: "0fc7b7960beb67ac252a908ef770b6ed",
    hash: "6e007a432f6134a7ee4147089cb486461541cc1fa25a1d1cdf6e077447f4f1ea1962ca78114ad599e8dca4c3138a2dce5fef3f9dbbe189633e449b7c0b19071c",
  },
  {
    // André Pereira — new SEO consultant (v74.31). Distinct person from
    // "andre" (André Pavlenco, the founder); username is andre-pereira.
    username: "andre-pereira",
    name: "André Pereira",
    fullName: "André Pereira",
    role: "SEO Consultant",
    dept: "SEO",
    salt: "6ec1a1e90e4e37f85489011710bc48d7",
    hash: "82a7a60d6f6352edbb5b352f797ef1b1d1849c8711a919c979f0750158f2c655eb5ab4abf94783d2989789512bccf81dcb27a0d0bddeda03cc71fd0b7eef6d2f",
  },
  {
    // João B. — new SEO consultant (v75.6). `name` must match the SEO
    // board column header "João B." so he sees his own column link.
    // Temp password generated out-of-band — Andre to hand it over + rotate.
    username: "joao-b",
    name: "João B.",
    fullName: "João Batista",
    role: "SEO Consultant",
    dept: "SEO",
    salt: "d7d60d6aa538084e6b6385a29274d7b8",
    hash: "188972f4fbf52acdb335489c79bc32b7443c4185a9bdee0e34c04fa5a5fc99f4ba4a824e84ab2b615dbf12f310220bb12588ec46d34ba155b86f47f879d0f446",
  },
  {
    username: "germano-c",
    name: "Germano C.",
    role: "ADS Consultant",
    dept: "ADS",
    salt: "bb6622826ccaefd1b6f0a9ba4283b69c",
    hash: "416eece1b238b1dd4175b548cfa7ada44f4c12343fe49191cbf6c73329b63ed960f32b94e5966156917504dfc04ad4af72cbc4b42e090a5678d991f895b6dcf6",
  },
  // Web designers — added v74.29. Web Dept only (see accessibleDepts):
  // they get /web but NOT /seo. Plain passwords were generated once and
  // handed to Andre out-of-band; only the scrypt salt+hash live here.
  {
    username: "mike",
    name: "Mike",
    fullName: "Mike Nobre",
    role: "Web Designer",
    dept: "Web",
    salt: "dcd10c8208accd64222497f003f20480",
    hash: "c1f1ee60a2f04d0c0f784b912e8830aaf7ef3094f3d159ec68c07558fcd5306b52879c6be7d1c8e1781c4bc73fa7cb6b47cb4acbc50f10b3b19fe0ed5efdaeee",
  },
  {
    username: "gustavo",
    name: "Gustavo",
    fullName: "Gustavo Rotini",
    role: "Web Designer",
    dept: "Web",
    salt: "142c5cf298fdcfeed6c09fc336953c0c",
    hash: "c1c57ffdd6dc7abd9b4e20b0697bb9507093f8d0fa02e7c688da565888e91418fe8111f6b7f7e64da4c9961c458c618f015009baad34633351930c90a344851e",
  },
  {
    username: "renan",
    name: "Renan",
    fullName: "Renan Alves",
    role: "Web Designer",
    dept: "Web",
    salt: "763d35ff3e7121fb2ac9a8b645edb90c",
    hash: "d37be5f7ba8db4b3425ec5e98349e8ab0877a2457af125f738837d03dcd63332c5be39cca2025c4fd19b9b45badcf959e1c2f8d2b4e66f80bebf72d0ff9c61f3",
  },
  {
    // Cylas — 4th web designer (v74.40). Temp password generated
    // out-of-band ("cylas-web-2026") — Andre to rotate to a real one.
    username: "cylas",
    name: "Cylas",
    fullName: "Cylas",
    role: "Web Designer",
    dept: "Web",
    salt: "e6877b670567eb571892c306e349a3c6",
    hash: "cebf6a2effe99af74ffe71655f70d72fbd4d52ec369c9101168d0902b9e0567ebb9a916e1c282b33d4d6a9a1e27cf50d7867f6469fdb56ffcd3a8c8529d3c7e0",
  },
];

/** Department slugs used across the workspace router. */
export const DEPARTMENTS = ["seo", "ads", "web", "commercial"] as const;
export type DeptSlug = (typeof DEPARTMENTS)[number];

/** Which department dashboards a credential row may open — VIEW access.
 *
 *  - SuperAdmins + Founder ("All") → every department.
 *  - SEO consultants → SEO **and** Web (they brief/QA the web builds).
 *  - Web designers → Web (full) **and** SEO (read-only — they can open
 *    the SEO client project pages to see what's shipping, but every
 *    edit/generation is blocked; see `editableDepts` + the middleware
 *    write-gate). Added v74.67.
 *  - ADS / Commercial → their own department only.
 *
 *  Source of truth for the per-dept page gates. Demoting someone is a
 *  code-deploy away — nothing about access lives in the cookie.
 *
 *  NOTE: viewing ≠ editing. Whether a user may CHANGE anything in a
 *  department is answered by `editableDepts` / `canEditDept`, which is a
 *  subset of this. Web → SEO is view-only, so "seo" appears here but NOT
 *  in `editableDepts`. */
export function accessibleDepts(
  row: Pick<EmployeeCredential, "dept" | "isAdmin"> | null | undefined,
): DeptSlug[] {
  if (!row) return [];
  if (row.isAdmin) return [...DEPARTMENTS];
  switch (row.dept) {
    case "All":
    case "Founder":
      return [...DEPARTMENTS];
    case "SEO":
      return ["seo", "web"];
    case "Web":
      return ["web", "seo"];
    case "ADS":
      return ["ads"];
    case "Commercial":
      return ["commercial"];
    default:
      return [];
  }
}

/** Which departments a credential row may CHANGE — a subset of
 *  `accessibleDepts`. The difference is the read-only grants: Web
 *  designers can OPEN the SEO project pages but cannot edit or generate
 *  anything there, so "seo" is absent from their editable set.
 *
 *  Everyone else edits exactly what they can view (access implies edit
 *  for their own department). Enforced server-side in middleware (the
 *  write-gate) and used client-side to hide edit/generation controls. */
export function editableDepts(
  row: Pick<EmployeeCredential, "dept" | "isAdmin"> | null | undefined,
): DeptSlug[] {
  if (!row) return [];
  if (row.isAdmin) return [...DEPARTMENTS];
  switch (row.dept) {
    case "All":
    case "Founder":
      return [...DEPARTMENTS];
    case "SEO":
      return ["seo", "web"];
    case "Web":
      // Web edits ONLY Web — SEO is view-only for designers.
      return ["web"];
    case "ADS":
      return ["ads"];
    case "Commercial":
      return ["commercial"];
    default:
      return [];
  }
}

/** True when the user behind `username` may open the `dept` dashboard. */
export function canAccessDept(
  username: string | null | undefined,
  dept: DeptSlug,
): boolean {
  if (!username) return false;
  const row = findEmployeeByUsername(username);
  return accessibleDepts(row).includes(dept);
}

/** True when the user behind `username` may CHANGE things in `dept`
 *  (edit fields, run AI generations, approve/send, delete). Web
 *  designers viewing SEO get `false` here — read-only. */
export function canEditDept(
  username: string | null | undefined,
  dept: DeptSlug,
): boolean {
  if (!username) return false;
  const row = findEmployeeByUsername(username);
  return editableDepts(row).includes(dept);
}

/** People a Web project can be assigned to — the web designers only
 *  (dept === "Web": Mike, Gustavo, Renan). SEO consultants can OPEN the
 *  Web Dept but they aren't the ones building sites, so they're kept out
 *  of the assignee dropdown + the board's employee filters. */
export function getWebAssignees(): {
  username: string;
  name: string;
  fullName: string;
}[] {
  return EMPLOYEE_CREDENTIALS.filter((c) => c.dept === "Web").map((c) => ({
    username: c.username,
    name: c.name,
    fullName: c.fullName ?? c.name,
  }));
}

/** Slack-style mention name for a username (full name when known, e.g.
 *  "Mike Nobre"). Used by the Generate-Backlog action so cards mention
 *  people the way they appear in Slack. */
export function getMentionName(username: string | null | undefined): string {
  if (!username) return "Equipa";
  const row = findEmployeeByUsername(username);
  return row?.fullName ?? row?.name ?? username;
}

/** Slack member IDs per username. A plain "@Full Name" pasted into Slack
 *  does NOT auto-link — only the `<@MEMBERID>` token does. Fill these in
 *  (Slack profile → ⋯ → "Copy member ID") so the Generate-Backlog output
 *  produces real, clickable mentions when pasted.
 *
 *  TODO(andre): paste the real IDs below. Empty = falls back to plain
 *  "@Full Name" text (current behaviour, no regression). */
export const SLACK_USER_IDS: Record<string, string> = {
  andre: "U05QPJZHE56",
  "andre-pereira": "U0BBED0K6NA",
  "yenisey-r": "U0ATWS0CH0V",
  mike: "U0ACN1V6Y74",
  gustavo: "U07R9FV85GR",
  renan: "U0AF149CU0P",
  // cylas: "U0XXXXXXX", // pending — Slack member id not provided yet
};

/** Slack member id for a username, or null when not configured. */
export function getSlackUserId(
  username: string | null | undefined,
): string | null {
  if (!username) return null;
  return SLACK_USER_IDS[username.trim().toLowerCase()] ?? null;
}

/** Rewrite a generated backlog so that "@Full Name" / "@name" tokens for
 *  known employees become real Slack mention tokens `<@MEMBERID>` — but
 *  ONLY for people whose member id is configured in SLACK_USER_IDS.
 *  Everyone else keeps the plain "@Name" text. */
export function linkifySlackMentions(text: string): string {
  let out = text;
  for (const c of EMPLOYEE_CREDENTIALS) {
    const id = SLACK_USER_IDS[c.username];
    if (!id) continue;
    const names = [c.fullName, c.name].filter(
      (n): n is string => Boolean(n),
    );
    for (const name of names) {
      // Replace "@Name" (word-boundary-ish) with <@ID>. Escape regex
      // metacharacters in the name.
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`@${esc}`, "g"), `<@${id}>`);
    }
  }
  return out;
}

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
