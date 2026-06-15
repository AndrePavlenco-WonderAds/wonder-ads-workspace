// AES-256-GCM encryption for the Web Dept credential vault.
//
// WordPress / hosting / FTP passwords for each web project are stored
// ENCRYPTED AT REST in KV — never in plaintext. The key is derived from
// the same `AUTH_SIGNING_SECRET` that signs session cookies (scrypt →
// 32 bytes), so there is nothing new for Andre to provision on Vercel:
// if the gate works, the vault works.
//
// Node runtime only (uses node:crypto). All call-sites are server-side
// API routes — a ciphertext blob is the only form of a secret that ever
// leaves the server, and only the role-gated `/reveal` endpoint ever
// turns it back into plaintext.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
// Static salt is fine here: the secret material is AUTH_SIGNING_SECRET
// (already high-entropy + env-injected), scrypt just stretches it to a
// 32-byte key. Per-record randomness comes from the 12-byte IV.
const KEY_SALT = "wonder-ads-web-vault.v1";

function getSigningSecret(): string {
  const env = process.env.AUTH_SIGNING_SECRET;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SIGNING_SECRET is missing or too short — the Web credential " +
        "vault can't derive an encryption key. Set it on Vercel.",
    );
  }
  return "dev-only-do-not-use-in-production-aaaaaaaaaa";
}

let cachedKey: Buffer | null = null;
let cachedKeySecret: string | null = null;

function getKey(): Buffer {
  const secret = getSigningSecret();
  if (cachedKey && cachedKeySecret === secret) return cachedKey;
  cachedKey = scryptSync(secret, KEY_SALT, 32);
  cachedKeySecret = secret;
  return cachedKey;
}

/** Encrypt a plaintext secret → `v1:<ivB64>:<tagB64>:<cipherB64>`.
 *  Empty / whitespace-only input returns "" so callers can treat "no
 *  secret set" uniformly. */
export function encryptSecret(plain: string): string {
  if (!plain || !plain.trim()) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Decrypt a `v1:…` payload. Returns null on any tamper / wrong-key /
 *  malformed input rather than throwing, so a corrupted record can't
 *  500 the reveal endpoint. */
export function decryptSecret(payload: string | undefined | null): string | null {
  if (!payload || typeof payload !== "string") return null;
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const data = Buffer.from(parts[3], "base64");
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** True when `payload` looks like one of our ciphertext blobs. */
export function isEncrypted(payload: string | undefined | null): boolean {
  return (
    typeof payload === "string" &&
    payload.startsWith(`${VERSION}:`) &&
    payload.split(":").length === 4
  );
}
