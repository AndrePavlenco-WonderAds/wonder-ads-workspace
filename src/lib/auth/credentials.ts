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

import type { WebDeliveryRights } from "@/lib/web-shared";

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
  /** Data de entrada (ISO yyyy-mm-dd) — o dia 1 da pessoa na casa. É a
   *  âncora dos EXAMES DE FASE da Formação: o exame da semana 1 abre 7 dias
   *  depois desta data, o dos 90 dias abre 90 dias depois.
   *
   *  ⚠️ SÃO DEFAULTS, NÃO REGISTO DE RH — exceto onde diz «confirmada». Os
   *  restantes foram inferidos do changelog (o dia em que a credencial da
   *  pessoa foi criada no workspace) e do arranque do workspace para quem já
   *  cá estava. O SuperAdmin corrige cada um na Data de entrada do Team Roster
   *  (`/admin/employees`), e o override em KV vence sempre este campo. */
  startedAt?: string;
  /** Retrato em `public/team/`. Só as pessoas que aparecem em cartões de
   *  escolha (hoje, os web designers no pedido de ticket) precisam de um —
   *  quem não tiver fica com a inicial. */
  photo?: string;
  /** false = a pessoa continua com conta e continua a aparecer nos tickets
   *  que já são dela, mas deixa de ser oferecida como destino de trabalho
   *  novo. Tirá-la de `EMPLOYEE_CREDENTIALS` fá-la-ia perder o login e
   *  transformaria o nome nos tickets antigos num username órfão. */
  assignable?: boolean;
};

export const EMPLOYEE_CREDENTIALS: EmployeeCredential[] = [
  {
    username: "andre",
    name: "André Pavlenco",
    fullName: "André Pavlenco",
    role: "Founder",
    dept: "All",
    startedAt: "2026-05-12",
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
    startedAt: "2026-05-12",
    isAdmin: true,
    salt: "38714f97f8304fa760c306cfebe7f111",
    hash: "247ed5439504afaf7ff9b63518f8ca7a0048543c54d9e50af74c0498af5be8de9f33aa417eb43671bc3b4c2380c0b3c4e112d6d9a51f2651bd06036dbca1499f",
  },
  {
    username: "alice",
    name: "Alice",
    role: "SuperAdmin",
    dept: "All",
    startedAt: "2026-05-12",
    isAdmin: true,
    salt: "9463f577eb3171ce484b15cf83a00fa0",
    hash: "6f727c917b71c7d8fa1b3efde211183c8715fc82ec29653c0b2fd7f7c11a511af09668fd8aa76b5c7b48f87ee937867abe3e9d1de6badf0763b4255c073a65dc",
  },
  {
    username: "manuel-s",
    name: "Manuel Silva",
    role: "SEO Consultant",
    dept: "SEO",
    startedAt: "2026-05-12",
    salt: "336026cc21c409c4aebdfb8148c8d0a5",
    hash: "dfa50f7e60e4f1601e4f6d7c95be9847d63e8b63f354a46bab2b09446ab1b459b003b2f0199522a762b02c97ecc255d640b7877f3f2e7e61e3ad69b1fdeff050",
  },
  {
    username: "fran-r",
    name: "Fran. Rosa",
    role: "SEO Consultant",
    dept: "SEO",
    // Confirmada pelo C-Level (v76.31) — entrou muito antes do workspace
    // existir, por isso o default herdado do arranque estava errado.
    startedAt: "2026-03-17",
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
    // Confirmada pelo C-Level (v76.31).
    startedAt: "2026-06-17",
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
    // Confirmada pelo C-Level (v76.31).
    startedAt: "2026-07-23",
    salt: "d7d60d6aa538084e6b6385a29274d7b8",
    hash: "188972f4fbf52acdb335489c79bc32b7443c4185a9bdee0e34c04fa5a5fc99f4ba4a824e84ab2b615dbf12f310220bb12588ec46d34ba155b86f47f879d0f446",
  },
  {
    username: "germano-c",
    name: "Germano C.",
    role: "ADS Consultant",
    dept: "ADS",
    startedAt: "2026-05-12",
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
    startedAt: "2026-06-16",
    photo: "/team/mike.jpg",
    salt: "dcd10c8208accd64222497f003f20480",
    hash: "c1f1ee60a2f04d0c0f784b912e8830aaf7ef3094f3d159ec68c07558fcd5306b52879c6be7d1c8e1781c4bc73fa7cb6b47cb4acbc50f10b3b19fe0ed5efdaeee",
  },
  {
    username: "gustavo",
    name: "Gustavo",
    fullName: "Gustavo Rotini",
    role: "Web Designer",
    dept: "Web",
    startedAt: "2026-06-16",
    photo: "/team/gustavo.jpg",
    salt: "142c5cf298fdcfeed6c09fc336953c0c",
    hash: "c1c57ffdd6dc7abd9b4e20b0697bb9507093f8d0fa02e7c688da565888e91418fe8111f6b7f7e64da4c9961c458c618f015009baad34633351930c90a344851e",
  },
  {
    username: "renan",
    name: "Renan",
    fullName: "Renan Alves",
    role: "Web Designer",
    dept: "Web",
    startedAt: "2026-06-16",
    photo: "/team/renan.jpg",
    salt: "763d35ff3e7121fb2ac9a8b645edb90c",
    hash: "d37be5f7ba8db4b3425ec5e98349e8ab0877a2457af125f738837d03dcd63332c5be39cca2025c4fd19b9b45badcf959e1c2f8d2b4e66f80bebf72d0ff9c61f3",
  },
  {
    // Cylas — 4.º web designer (v74.40). Deixou de receber trabalho novo na
    // v76.61: continua com conta e continua a aparecer nos tickets que já
    // são dele, mas sai dos cartões de atribuição.
    username: "cylas",
    name: "Cylas",
    fullName: "Cylas",
    role: "Web Designer",
    dept: "Web",
    assignable: false,
    startedAt: "2026-06-23",
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

/** Quem pode mexer na DATA DE ENTREGA PREVISTA de um projeto Web.
 *
 *  A data é um compromisso do departamento que constrói, não um campo de
 *  planeamento partilhado — por isso:
 *
 *  - `canSet`      → pôr a data num projeto que ainda não a tem. Web
 *                    designers (dept "Web") + SuperAdmins. Consultores de
 *                    SEO abrem e editam o board mas não comprometem datas.
 *  - `canOverride` → corrigir uma data JÁ gravada. Só SuperAdmins: depois
 *                    de posta, a data fica trancada para quem a pôs, e a
 *                    correção de um engano passa pelo C-Level (e fica no
 *                    activity log).
 *
 *  Isto é a fonte de verdade das duas pontas: as rotas
 *  `/api/web/projects` gastam-na para aceitar ou recusar o write, e as
 *  páginas passam o resultado ao board/detalhe para esconder ou trancar
 *  o input. Nunca confiar só no lado do browser.
 *
 *  O tipo vive em `web-shared.ts` (livre de imports de servidor) para que
 *  os componentes "use client" o possam importar sem puxar esta tabela de
 *  hashes para o bundle. */
export function webDeliveryRights(
  row: Pick<EmployeeCredential, "dept" | "isAdmin"> | null | undefined,
): WebDeliveryRights {
  if (!row) return { canSet: false, canOverride: false };
  const admin = Boolean(row.isAdmin);
  return {
    canSet: admin || row.dept === "Web",
    canOverride: admin,
  };
}

/** People a Web project can be assigned to — the web designers only
 *  (dept === "Web": Mike, Gustavo, Renan). SEO consultants can OPEN the
 *  Web Dept but they aren't the ones building sites, so they're kept out
 *  of the assignee dropdown + the board's employee filters. */
export function getWebAssignees(): {
  username: string;
  name: string;
  fullName: string;
  photo?: string;
}[] {
  return EMPLOYEE_CREDENTIALS.filter(
    (c) => c.dept === "Web" && c.assignable !== false,
  ).map((c) => ({
    username: c.username,
    name: c.name,
    fullName: c.fullName ?? c.name,
    ...(c.photo ? { photo: c.photo } : {}),
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
  // Alice (RH) — é a ela que o resumo mensal de assiduidade é dirigido no
  // #ausencias, no dia 1 de cada mês.
  alice: "U05PZR0UWAX",
  "andre-pereira": "U0BBED0K6NA",
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

/** Toda a gente que um SuperAdmin pode espreitar no «Ver como» — só os
 *  campos que a UI mostra.
 *
 *  Nunca devolve `salt`/`hash`: esta lista viaja para o browser no chip do
 *  header, e um seletor de utilizadores não é motivo para pôr material de
 *  password do lado do cliente. Ordenada por departamento e depois por nome,
 *  que é como o seletor os agrupa. */
export function listImpersonationTargets(): Array<{
  username: string;
  name: string;
  role: string;
  dept: string;
  isAdmin: boolean;
}> {
  const deptOrder = ["All", "SEO", "ADS", "Web", "Commercial"];
  return EMPLOYEE_CREDENTIALS.map((c) => ({
    username: c.username,
    name: c.name,
    role: c.role,
    dept: c.dept,
    isAdmin: Boolean(c.isAdmin),
  })).sort((a, b) => {
    const da = deptOrder.indexOf(a.dept);
    const db = deptOrder.indexOf(b.dept);
    const ra = da === -1 ? deptOrder.length : da;
    const rb = db === -1 ? deptOrder.length : db;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "pt");
  });
}

/** Sem acentos, sem pontuação, minúsculas — "Fran. Rosa" e "fran rosa" têm de
 *  bater certo, porque o roster do /admin e as credenciais foram escritos em
 *  sítios diferentes por pessoas diferentes. */
function nameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A credencial de login correspondente a uma linha do roster do /admin.
 *
 *  Duas listas descrevem as mesmas pessoas: `EMPLOYEE_CREDENTIALS` (quem entra
 *  na app) e o roster editável do SuperAdmin (quem trabalha cá, incluindo quem
 *  não tem login). Isto é a ponte — e é o que permite que a Data de entrada
 *  escrita no /admin/employees seja a MESMA que arranca o relógio dos exames.
 *  Sem ponte, havia duas datas de entrada por pessoa e uma delas estava sempre
 *  errada.
 *
 *  Casa primeiro pelo id (os seeds usam de propósito o username como id) e só
 *  depois pelo nome, já normalizado. */
export function findCredentialForRosterRow(
  id: string | null | undefined,
  name: string | null | undefined,
): EmployeeCredential | null {
  if (id) {
    const byId = EMPLOYEE_CREDENTIALS.find(
      (c) => c.username === id.trim().toLowerCase(),
    );
    if (byId) return byId;
  }
  if (!name) return null;
  const key = nameKey(name);
  if (!key) return null;
  return (
    EMPLOYEE_CREDENTIALS.find(
      (c) => nameKey(c.name) === key || (c.fullName && nameKey(c.fullName) === key),
    ) ?? null
  );
}

/** O que uma linha do Team Roster pode abrir na app, em forma servível ao
 *  browser — sem uma única linha da tabela de credenciais.
 *
 *  A coluna «Access» do `/admin/employees` responde a três perguntas que
 *  antes só se respondiam a ler código: esta pessoa tem login?, entra como
 *  SuperAdmin?, e que departamentos é que abre (e em quais só vê)? */
export type RosterAccess = {
  username: string;
  isAdmin: boolean;
  /** Departamentos que abre. Rótulos do roster: "SEO" | "ADS" | "Web" |
   *  "Comercial". */
  view: string[];
  /** Subconjunto de `view` onde também pode mexer. O resto é só leitura. */
  edit: string[];
};

const DEPT_LABEL: Record<DeptSlug, string> = {
  seo: "SEO",
  ads: "ADS",
  web: "Web",
  commercial: "Comercial",
};

/** Acesso da linha do roster, ou null quando aquela pessoa trabalha cá mas
 *  não tem conta no workspace. Resolvido no servidor e passado já mastigado
 *  aos componentes — a tabela de hashes nunca vai para o bundle. */
export function rosterAccessFor(
  id: string | null | undefined,
  name: string | null | undefined,
): RosterAccess | null {
  const row = findCredentialForRosterRow(id, name);
  if (!row) return null;
  return {
    username: row.username,
    isAdmin: Boolean(row.isAdmin),
    view: accessibleDepts(row).map((d) => DEPT_LABEL[d]),
    edit: editableDepts(row).map((d) => DEPT_LABEL[d]),
  };
}

/** True when the username corresponds to one of the three SuperAdmin
 *  accounts (Alex / Alice / Andre). Source of truth for /admin gating. */
export function isAdminUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  const row = findEmployeeByUsername(username);
  return Boolean(row?.isAdmin);
}
