// HMAC-signed session cookies for the workspace login gate.
//
// Why HMAC instead of a "real" JWT library: the middleware runs in
// Edge runtime, which can't `require("jsonwebtoken")` or any node-
// only crypto. WebCrypto's subtle API IS available in Edge, so we
// roll a tiny HMAC-SHA256 wrapper that works in both Edge (middleware
// verify) and Node (login API issue + read).
//
// Cookie payload is intentionally minimal: just the username + the
// expiry epoch. No roles in the cookie — those are resolved fresh
// from `credentials.ts` server-side on every render, so demoting a
// user is a code-deploy away (no cookie purge needed).

import { findEmployeeByUsername, isAdminUsername } from "./credentials";

export const SESSION_COOKIE = "wa-session";

/** 7 days in milliseconds — bumped from 48h in v74.23.1 so consultants
 *  don't re-auth twice a week. After this the cookie's `exp` field
 *  has passed and middleware redirects to /login regardless of
 *  whether the signature is still valid. The cookie's own `maxAge`
 *  matches so browsers also drop it from disk on expiry. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_MAX_AGE_MS / 1000);

export type SessionPayload = {
  /** Username de QUEM FEZ LOGIN (lowercase, matches credentials.ts).
   *  Nunca muda enquanto a sessão durar — nem sequer a ver como outra
   *  pessoa. É o que garante que o caminho de volta existe sempre. */
  u: string;
  /** «A ver como» — o username que o SuperAdmin está a espreitar. Só o
   *  `u` é a identidade real; este é uma lente por cima dela.
   *
   *  Vai DENTRO da carga assinada de propósito: um campo à parte, ou um
   *  segundo cookie, seria falsificável por quem soubesse o nome de outro
   *  utilizador. Assim, trocar de pele exige a chave de assinatura.
   *
   *  E `readSession` só o honra quando `u` é SuperAdmin — a verificação
   *  vive aqui, no leitor, e não em cada consumidor, para não haver um
   *  sítio que se esqueça dela. */
  as?: string;
  /** Expiry — `Date.now() + SESSION_MAX_AGE_MS` at issue time. */
  exp: number;
  /** Issued-at — useful for "session age" UI without doing maths. */
  iat: number;
};

/** Quem a app deve tratar como utilizador nesta sessão: a pessoa que está
 *  a ser vista, se houver, senão quem fez login. Todos os gates (páginas,
 *  middleware, APIs) usam ISTO — é o que faz o SuperAdmin ver mesmo a app
 *  do outro, com os mesmos limites, em vez de uma imitação. */
export function effectiveUsername(
  session: SessionPayload | null | undefined,
): string | null {
  if (!session) return null;
  return session.as ?? session.u;
}

/** True quando a sessão está a ver a app como outra pessoa. */
export function isImpersonating(
  session: SessionPayload | null | undefined,
): boolean {
  return Boolean(session?.as && session.as !== session.u);
}

/** Look up the secret used to sign cookies. In prod we REQUIRE the
 *  env var so a forgotten setting fails loudly rather than letting
 *  the workspace gate slide on a weak default. In dev we fall back to
 *  a hard-coded value so `npm run dev` works without any setup — but
 *  that fallback throws in `NODE_ENV=production` to avoid shipping it. */
function getSigningSecret(): string {
  const env = process.env.AUTH_SIGNING_SECRET;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SIGNING_SECRET is missing or too short (need ≥16 chars). " +
        "Set it on Vercel before deploying.",
    );
  }
  // Dev-only fallback — exists purely so localhost works out of the
  // box. The CI/Vercel deploys always set the real value via env.
  return "dev-only-do-not-use-in-production-aaaaaaaaaa";
}

// ---- Base64url helpers (Edge-safe — no Buffer) ----

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  // Allocate the backing ArrayBuffer explicitly so TS narrows the
  // return type to `Uint8Array<ArrayBuffer>` — required by
  // crypto.subtle.verify's BufferSource parameter under the strict
  // typings shipping with Next 15.5 / TS 5.9. A bare `new
  // Uint8Array(len)` widens to `Uint8Array<ArrayBufferLike>` and
  // gets rejected at the verify call.
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8ToBase64Url(s: string): string {
  return bytesToBase64Url(new TextEncoder().encode(s));
}

function base64UrlToUtf8(s: string): string {
  return new TextDecoder().decode(base64UrlToBytes(s));
}

// ---- HMAC ----

let cachedKey: CryptoKey | null = null;
let cachedKeySecret: string | null = null;

async function getKey(): Promise<CryptoKey> {
  const secret = getSigningSecret();
  if (cachedKey && cachedKeySecret === secret) return cachedKey;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  cachedKey = key;
  cachedKeySecret = secret;
  return key;
}

/** Issue a signed cookie value for a username. Caller is responsible
 *  for setting it via res.cookies.set with the matching maxAge.
 *
 *  `options.as` põe a sessão a ver a app como outra pessoa. Quem chama
 *  TEM de confirmar que `username` é SuperAdmin antes de o passar — e o
 *  `readSession` volta a confirmar na leitura, para que um cookie forjado
 *  noutro tempo (ou uma despromoção depois de emitido) não valha nada. */
export async function issueSession(
  username: string,
  options?: { as?: string | null; expiresAt?: number },
): Promise<{
  cookieValue: string;
  payload: SessionPayload;
}> {
  const iat = Date.now();
  const as = options?.as?.trim().toLowerCase() || null;
  const payload: SessionPayload = {
    u: username,
    // Ver como outra pessoa NÃO estica a sessão: mantém-se o fim do prazo
    // original. Senão, uma volta pelo chip renovava a semana sem ninguém
    // voltar a escrever a password.
    exp: options?.expiresAt ?? iat + SESSION_MAX_AGE_MS,
    iat,
    ...(as && as !== username ? { as } : {}),
  };
  const body = utf8ToBase64Url(JSON.stringify(payload));
  const key = await getKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const cookieValue = `${body}.${bytesToBase64Url(new Uint8Array(sig))}`;
  return { cookieValue, payload };
}

/** Verify a cookie value and return the decoded payload, or null on
 *  any tamper / expiry / parse failure. Designed to be called from
 *  both middleware (Edge) and server components (Node). */
export async function readSession(
  cookieValue: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  const body = cookieValue.slice(0, dot);
  const sigB64 = cookieValue.slice(dot + 1);
  let sigBytes: Uint8Array;
  try {
    sigBytes = base64UrlToBytes(sigB64);
  } catch {
    return null;
  }
  const key = await getKey();
  let ok = false;
  try {
    // Cast through BufferSource — the underlying bytes are correct, the
    // narrowing is purely a TS quirk on Uint8Array<ArrayBufferLike>.
    ok = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as BufferSource,
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }
  if (!ok) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlToUtf8(body));
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.u !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number"
  ) {
    return null;
  }
  if (Date.now() > payload.exp) return null;
  // A LENTE VERIFICA-SE AQUI, NÃO EM QUEM LÊ. Um cookie válido pode ter sido
  // emitido quando `u` ainda era SuperAdmin; se entretanto deixou de ser, a
  // lente cai e a sessão volta a ser a dele. O mesmo para um `as` que aponte
  // para alguém que já não existe nas credenciais. Só se aceita uma lente
  // que continue a fazer sentido AGORA — a alternativa era cada página
  // lembrar-se de a validar, e uma esquecer-se.
  if (typeof payload.as === "string" && payload.as) {
    const target = payload.as.trim().toLowerCase();
    if (
      target === payload.u ||
      !isAdminUsername(payload.u) ||
      !findEmployeeByUsername(target)
    ) {
      return { u: payload.u, exp: payload.exp, iat: payload.iat };
    }
    return { ...payload, as: target };
  }
  if ("as" in payload) {
    return { u: payload.u, exp: payload.exp, iat: payload.iat };
  }
  return payload;
}
