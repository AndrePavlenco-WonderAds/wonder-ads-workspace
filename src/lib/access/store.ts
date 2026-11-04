// Acessos à app (v78.72) — o lado do servidor: o cofre das passwords, as
// ações do COO e a vista da consola. Node only.
//
// O COFRE. As passwords do código (credentials.ts) só existem como hash —
// ninguém as consegue ler, nem a app. Quando o André gera uma password nova
// aqui, ela fica em `access:cred:<u>` com DUAS formas:
//   • salt + hash scrypt (os mesmos parâmetros de credentials.ts) — é o que
//     o login verifica, e ganha à linha do código;
//   • uma cópia cifrada AES-256-GCM, com uma chave derivada (HKDF) do
//     AUTH_SIGNING_SECRET — é o que permite o «Copiar acesso». Um dump do KV,
//     sozinho, não revela password nenhuma.
// Se o AUTH_SIGNING_SECRET mudar, as cópias deixam de se ler (o login
// continua a funcionar pelo hash) — basta regenerar.

import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomInt, randomUUID } from "node:crypto";
import { kv } from "@vercel/kv";
import { EMPLOYEE_CREDENTIALS, findEmployeeByUsername } from "@/lib/auth/credentials";
import { scryptHash } from "@/lib/auth/password";
import { getTeamAvatar } from "@/lib/team-avatars";
import { forgetAccessGateCache } from "./gate";
import {
  ACCESS_GATE_KEY,
  ACCESS_LAST_LOGIN_KEY,
  ACCESS_LOG_KEY,
  ACCESS_LOG_MAX,
  ACCESS_OWNER,
  FORMER_ACCOUNTS,
  accessCredKey,
  hydrateGateEntry,
  type AccessAction,
  type AccessGateEntry,
  type AccessLogEvent,
  type AccessRowView,
} from "./shared";

export const accessConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// ---------------------------------------------------------------------------
// Cofre
// ---------------------------------------------------------------------------

type VaultRecord = {
  salt: string;
  hash: string;
  /** AES-256-GCM: iv (12 B), texto cifrado e tag — tudo em hex. */
  iv: string;
  ct: string;
  tag: string;
  setAt: number;
  setBy: string;
};

function hydrateVault(raw: unknown): VaultRecord | null {
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
  const str = (x: unknown) => (typeof x === "string" && x ? x : null);
  const salt = str(o.salt);
  const hash = str(o.hash);
  if (!salt || !hash) return null;
  return {
    salt,
    hash,
    iv: str(o.iv) ?? "",
    ct: str(o.ct) ?? "",
    tag: str(o.tag) ?? "",
    setAt: typeof o.setAt === "number" ? o.setAt : 0,
    setBy: str(o.setBy) ?? "",
  };
}

function vaultKey(): Buffer {
  const secret = process.env.AUTH_SIGNING_SECRET;
  let base: string;
  if (secret && secret.length >= 16) base = secret;
  else if (process.env.NODE_ENV === "production") throw new Error("AUTH_SIGNING_SECRET em falta — o cofre não cifra sem ele.");
  else base = "dev-only-do-not-use-in-production-aaaaaaaaaa";
  return Buffer.from(hkdfSync("sha256", base, "wa-access-vault", "password-v1", 32));
}

function encrypt(plain: string): Pick<VaultRecord, "iv" | "ct" | "tag"> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { iv: iv.toString("hex"), ct: ct.toString("hex"), tag: cipher.getAuthTag().toString("hex") };
}

function decrypt(rec: VaultRecord): string | null {
  if (!rec.iv || !rec.ct || !rec.tag) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(rec.iv, "hex"));
    decipher.setAuthTag(Buffer.from(rec.tag, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(rec.ct, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Sem caracteres que se confundem (0/O, 1/l/I): 3 grupos de 4 → ~70 bits. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generatePassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  // Garante pelo menos um dígito, para quem cola num sítio com regras.
  let pw = `${group()}-${group()}-${group()}`;
  if (!/\d/.test(pw)) pw = pw.slice(0, -1) + String(randomInt(2, 10));
  return pw;
}

/** O hash que o login deve usar — o do cofre, se houver. Lança se o KV
 *  falhar (o login decide o que fazer). */
export async function getVaultHash(username: string): Promise<{ salt: string; hash: string } | null> {
  if (!accessConfigured) return null;
  const rec = hydrateVault(await kv.get<unknown>(accessCredKey(username)));
  return rec ? { salt: rec.salt, hash: rec.hash } : null;
}

/** A entrada de UMA pessoa no portão, lida agora (sem cache) — para o
 *  login e para as ações. Lança se o KV falhar. */
export async function readGateEntryFresh(username: string): Promise<AccessGateEntry | null> {
  if (!accessConfigured) return null;
  return hydrateGateEntry(await kv.hget<unknown>(ACCESS_GATE_KEY, username));
}

/** A password em claro, para o «Copiar acesso». null = não está no cofre. */
export async function revealPassword(username: string): Promise<string | null> {
  if (!accessConfigured) return null;
  const rec = hydrateVault(await kv.get<unknown>(accessCredKey(username)));
  return rec ? decrypt(rec) : null;
}

/** Último login (melhor esforço — nunca atrasa nem estraga um login). */
export async function recordLogin(username: string): Promise<void> {
  if (!accessConfigured) return;
  try {
    await kv.hset(ACCESS_LAST_LOGIN_KEY, { [username]: { at: Date.now() } });
  } catch {
    /* sem registo desta vez */
  }
}

// ---------------------------------------------------------------------------
// Vista da consola
// ---------------------------------------------------------------------------

const DEPT_ORDER = ["All", "SEO", "ADS", "Web", "Commercial"];

function deptRank(dept: string): number {
  const i = DEPT_ORDER.indexOf(dept);
  return i === -1 ? DEPT_ORDER.length : i;
}

function rowFor(
  username: string,
  gate: AccessGateEntry | null,
  lastLoginAt: number | null,
  vaultSetAt: number | null,
): AccessRowView | null {
  const c = findEmployeeByUsername(username);
  if (!c) return null;
  return {
    username: c.username,
    name: c.name,
    fullName: c.fullName ?? c.name,
    role: c.role,
    dept: c.dept,
    isAdmin: Boolean(c.isAdmin),
    viewerOf: c.viewerOf ?? null,
    readOnlyDepts: c.readOnlyDepts ?? [],
    tags: c.tags ?? [],
    avatar: getTeamAvatar(c.username),
    status: gate?.revoked ? "cancelado" : "ativo",
    revokedAt: gate?.revoked ? gate.revokedAt : null,
    sessionsResetAt: gate?.validAfter ?? null,
    lastLoginAt,
    vaultSetAt,
    startedAt: c.startedAt ?? null,
    isSelf: c.username === ACCESS_OWNER,
    former: null,
  };
}

function atOf(raw: unknown): number | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  const at = v && typeof v === "object" ? (v as { at?: unknown }).at : null;
  return typeof at === "number" ? at : null;
}

function hydrateEvent(raw: unknown): AccessLogEvent | null {
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
  const actions: AccessAction[] = ["regenerar", "cancelar", "reativar", "terminar-sessoes"];
  if (typeof o.username !== "string" || typeof o.at !== "number" || !actions.includes(o.action as AccessAction)) return null;
  return {
    id: typeof o.id === "string" ? o.id : `${o.at}-${o.username}`,
    at: o.at,
    by: typeof o.by === "string" ? o.by : "",
    username: o.username,
    name: typeof o.name === "string" ? o.name : o.username,
    action: o.action as AccessAction,
    endedSessions: o.endedSessions === true,
  };
}

export type AccessOverview = { rows: AccessRowView[]; events: AccessLogEvent[]; trackingSince: number | null };

export async function loadAccessOverview(): Promise<AccessOverview> {
  const usernames = EMPLOYEE_CREDENTIALS.map((c) => c.username);
  let gateRaw: Record<string, unknown> | null = null;
  let loginsRaw: Record<string, unknown> | null = null;
  let vaultRaw: unknown[] = [];
  let logRaw: unknown[] = [];
  if (accessConfigured) {
    [gateRaw, loginsRaw, vaultRaw, logRaw] = await Promise.all([
      kv.hgetall<Record<string, unknown>>(ACCESS_GATE_KEY),
      kv.hgetall<Record<string, unknown>>(ACCESS_LAST_LOGIN_KEY),
      kv.mget<unknown[]>(...usernames.map(accessCredKey)),
      kv.lrange<unknown>(ACCESS_LOG_KEY, 0, 199),
    ]);
  }
  const rows = usernames
    .map((u, i) =>
      rowFor(
        u,
        hydrateGateEntry(gateRaw?.[u]),
        atOf(loginsRaw?.[u]),
        hydrateVault(vaultRaw?.[i])?.setAt || null,
      ),
    )
    .filter((r): r is AccessRowView => Boolean(r));

  for (const f of FORMER_ACCOUNTS) {
    if (rows.some((r) => r.username === f.username)) continue;
    rows.push({
      username: f.username,
      name: f.name,
      fullName: f.name,
      role: f.role,
      dept: f.dept,
      isAdmin: false,
      viewerOf: null,
      readOnlyDepts: [],
      tags: [],
      avatar: getTeamAvatar(f.username),
      status: "removido",
      revokedAt: Date.parse(`${f.until}T12:00:00Z`),
      sessionsResetAt: null,
      lastLoginAt: null,
      vaultSetAt: null,
      startedAt: f.from,
      isSelf: false,
      former: { from: f.from, until: f.until, note: f.note },
    });
  }

  rows.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    const d = deptRank(a.dept) - deptRank(b.dept);
    return d !== 0 ? d : a.name.localeCompare(b.name, "pt");
  });

  const events = (logRaw ?? []).map(hydrateEvent).filter((e): e is AccessLogEvent => Boolean(e));
  const loginTimes = Object.values(loginsRaw ?? {}).map(atOf).filter((x): x is number => x !== null);
  return { rows, events, trackingSince: loginTimes.length ? Math.min(...loginTimes) : null };
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

export class AccessError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

async function writeGate(username: string, entry: AccessGateEntry): Promise<void> {
  await kv.hset(ACCESS_GATE_KEY, { [username]: entry });
  forgetAccessGateCache();
}

async function pushEvent(event: AccessLogEvent): Promise<void> {
  try {
    await kv.lpush(ACCESS_LOG_KEY, event);
    await kv.ltrim(ACCESS_LOG_KEY, 0, ACCESS_LOG_MAX - 1);
  } catch {
    /* o registo é um extra — a ação já está feita */
  }
}

export type AccessActionResult = {
  row: AccessRowView;
  event: AccessLogEvent;
  /** Só na regeneração: a password nova, para mostrar e copiar logo. */
  password?: string;
};

/** Aplica uma ação do COO a uma pessoa. `by` = quem fez login (o André). */
export async function applyAccessAction(
  action: AccessAction,
  usernameRaw: string,
  by: string,
  opts: { endSessions?: boolean } = {},
): Promise<AccessActionResult> {
  if (!accessConfigured) throw new AccessError("O armazenamento (KV) não está configurado neste ambiente.", 503);
  const cred = findEmployeeByUsername(usernameRaw);
  if (!cred) throw new AccessError("Esta pessoa não tem conta na app.", 404);
  const username = cred.username;
  const self = username === by;
  const now = Date.now();
  const prev = (await readGateEntryFresh(username)) ?? { revoked: false, revokedAt: null, validAfter: null };
  let password: string | undefined;
  let endedSessions = false;

  switch (action) {
    case "cancelar": {
      if (self) throw new AccessError("Não podes cancelar o teu próprio acesso.", 400);
      if (prev.revoked) throw new AccessError("Este acesso já está cancelado.", 409);
      await writeGate(username, { revoked: true, revokedAt: now, validAfter: now });
      break;
    }
    case "reativar": {
      if (!prev.revoked) throw new AccessError("Este acesso já está ativo.", 409);
      // O validAfter fica: os cookies de antes do cancelamento não voltam.
      await writeGate(username, { revoked: false, revokedAt: null, validAfter: prev.validAfter ?? now });
      break;
    }
    case "terminar-sessoes": {
      if (self) throw new AccessError("Para terminares as tuas sessões usa «Terminar sessão» no menu.", 400);
      await writeGate(username, { ...prev, validAfter: now });
      break;
    }
    case "regenerar": {
      if (prev.revoked) throw new AccessError("Reativa o acesso antes de gerar uma password nova.", 409);
      password = generatePassword();
      const salt = randomBytes(16).toString("hex");
      const rec: VaultRecord = { salt, hash: scryptHash(password, salt), ...encrypt(password), setAt: now, setBy: by };
      await kv.set(accessCredKey(username), rec);
      // As tuas próprias sessões nunca caem daqui — ficavas na rua a meio.
      endedSessions = Boolean(opts.endSessions) && !self;
      if (endedSessions) await writeGate(username, { ...prev, validAfter: now });
      break;
    }
    default:
      throw new AccessError("Ação desconhecida.", 400);
  }

  const event: AccessLogEvent = {
    id: randomUUID(),
    at: now,
    by,
    username,
    name: cred.fullName ?? cred.name,
    action,
    ...(action === "regenerar" ? { endedSessions } : {}),
  };
  await pushEvent(event);

  const [gateAfter, loginRaw, vaultAfter] = await Promise.all([
    readGateEntryFresh(username),
    kv.hget<unknown>(ACCESS_LAST_LOGIN_KEY, username),
    kv.get<unknown>(accessCredKey(username)),
  ]);
  const row = rowFor(username, gateAfter, atOf(loginRaw), hydrateVault(vaultAfter)?.setAt || null)!;
  return { row, event, password };
}
