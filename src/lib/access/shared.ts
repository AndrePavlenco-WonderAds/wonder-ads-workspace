// Acessos à app (v78.72) — a consola do COO para ver, copiar, regenerar e
// cancelar os logins do workspace. Este ficheiro é PURO (Edge, Node e
// browser): constantes, tipos e o texto da mensagem que se copia. Nada de
// segredos aqui — a password só existe do lado do servidor (lib/access/store)
// e viaja para o browser apenas quando o André a pede.
//
// Só UMA pessoa abre a consola: o André (COO), decidido por quem FEZ LOGIN e
// nunca com o «Ver como» ativo. Os outros SuperAdmins não a veem.

import { TOP_ADMIN_USERNAME } from "@/lib/auth/top-admin";

/** O único username que abre /admin/acessos e a API — o topo (v78.74:
 *  definido em lib/auth/top-admin). */
export const ACCESS_OWNER = TOP_ADMIN_USERNAME;

/** O endereço que vai na mensagem de acesso. */
export const ACCESS_LOGIN_URL = "https://workspace.wonder-ads.com/login";

/** KV — o portão que o middleware lê (pequeno de propósito: só estados). */
export const ACCESS_GATE_KEY = "access:gate";
/** KV — o último login de cada pessoa (desde a v78.72). */
export const ACCESS_LAST_LOGIN_KEY = "access:lastlogin";
/** KV — o registo de alterações (LPUSH, guarda os últimos 500). */
export const ACCESS_LOG_KEY = "access:log";
export const ACCESS_LOG_MAX = 500;
/** KV — a password do cofre de uma pessoa (hash + cópia cifrada). */
export const accessCredKey = (username: string) => `access:cred:${username}`;

/** Quanto tempo o middleware guarda o portão em memória. Uma alteração
 *  chega a todas as instâncias em até este tempo. */
export const ACCESS_GATE_TTL_MS = 30_000;

/** O estado de uma pessoa no portão. Sem entrada = ativa, sem limites. */
export type AccessGateEntry = {
  /** true = não entra, e as sessões abertas caem. */
  revoked: boolean;
  /** Quando foi cancelado (ms), para a lista dos «Passados». */
  revokedAt: number | null;
  /** Sessões emitidas ANTES deste instante (ms) deixam de valer. Fica posto
   *  depois de uma reativação, para que os cookies antigos não voltem. */
  validAfter: number | null;
};

export type AccessGate = Record<string, AccessGateEntry>;

/** Uma linha do KV, venha como vier (objeto já desserializado, string JSON
 *  ou lixo) → entrada válida ou null. */
export function hydrateGateEntry(raw: unknown): AccessGateEntry | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  return {
    revoked: o.revoked === true,
    revokedAt: num(o.revokedAt),
    validAfter: num(o.validAfter),
  };
}

/** A sessão (pelo `u` = quem fez login, e o `iat`) deixou de valer? */
export function isSessionBlocked(
  session: { u: string; iat: number } | null | undefined,
  gate: AccessGate,
): boolean {
  if (!session) return false;
  const entry = gate[session.u];
  if (!entry) return false;
  if (entry.revoked) return true;
  return entry.validAfter !== null && session.iat < entry.validAfter;
}

export type AccessAction = "regenerar" | "cancelar" | "reativar" | "terminar-sessoes";

export const ACCESS_ACTION_LABEL: Record<AccessAction, string> = {
  regenerar: "Password nova",
  cancelar: "Acesso cancelado",
  reativar: "Acesso reativado",
  "terminar-sessoes": "Sessões terminadas",
};

export type AccessLogEvent = {
  id: string;
  at: number;
  by: string;
  username: string;
  name: string;
  action: AccessAction;
  /** Na regeneração: se as sessões abertas também terminaram. */
  endedSessions?: boolean;
};

/** Contas que já saíram do código (credentials.ts) — não há nada para
 *  reativar, ficam só como histórico. Datas tiradas do git. */
export const FORMER_ACCOUNTS: Array<{
  username: string;
  name: string;
  role: string;
  dept: string;
  from: string;
  until: string;
  note: string;
}> = [
  {
    username: "germano-c",
    name: "Germano Cunha",
    role: "ADS Consultant",
    dept: "ADS",
    from: "2026-06-09",
    until: "2026-09-17",
    note: "Saiu na v77.35; o Hugo Silva entrou no lugar dele.",
  },
  {
    username: "yenisey-r",
    name: "Yenisey Rodriguez",
    role: "SEO Consultant",
    dept: "SEO",
    from: "2026-06-09",
    until: "2026-07-21",
    note: "Removida quando o João B. entrou no SEO.",
  },
];

/** O que a página recebe por pessoa — NUNCA salt, hash nem password. */
export type AccessRowView = {
  username: string;
  name: string;
  fullName: string;
  role: string;
  dept: string;
  isAdmin: boolean;
  viewerOf: string | null;
  readOnlyDepts: string[];
  tags: string[];
  avatar: string | null;
  status: "ativo" | "cancelado" | "removido";
  revokedAt: number | null;
  sessionsResetAt: number | null;
  lastLoginAt: number | null;
  /** A password está no cofre (copiável) desde… */
  vaultSetAt: number | null;
  startedAt: string | null;
  isSelf: boolean;
  /** Só nas contas removidas do código. */
  former: { from: string; until: string; note: string } | null;
};

/** O primeiro nome para a saudação — «Fran. Rosa» → «Fran». */
export function greetingName(row: Pick<AccessRowView, "name" | "fullName">): string {
  const first = (row.fullName || row.name).trim().split(/\s+/)[0] ?? "";
  return first.replace(/\.+$/, "");
}

/** A mensagem que se copia para enviar à pessoa. */
export function accessMessage(
  row: Pick<AccessRowView, "name" | "fullName" | "username">,
  password: string | null,
): string {
  const lines = [
    `Olá ${greetingName(row)}! Aqui tens o teu acesso ao Workspace da Wonder Ads:`,
    "",
    `🔗 ${ACCESS_LOGIN_URL}`,
    `👤 Utilizador: ${row.username}`,
  ];
  if (password) lines.push(`🔑 Password: ${password}`);
  lines.push("", password ? "Guarda-a num sítio seguro e não a partilhes com ninguém." : "A password envio-ta à parte.");
  return lines.join("\n");
}
