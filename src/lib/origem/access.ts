// Origem de Pacientes — quem entra em /<slug>/origem:
//   • a receção do cliente — com o PIN do cliente (6 dígitos), que emite um
//     cookie próprio (`orig_<slug>`, HMAC com o AUTH_SIGNING_SECRET da app,
//     180 dias: o tablet da receção não volta a pedir o PIN todas as semanas);
//   • a equipa WonderAds — qualquer sessão válida entra direto. Regista quem
//     pode editar o SEO; o «ver como» é só leitura.
//
// A página e as APIs estão fora do matcher do middleware (como o Reviews
// Hub): a verificação é toda feita aqui.
//
// O PIN NÃO vive no repo: só o scrypt (salt + hash, os parâmetros de
// src/lib/auth/password.ts). O texto fica com o André, num ficheiro no
// Desktop. Para trocar: salt novo + `scryptHash(novo, salt)`.

import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { editableDepts } from "@/lib/auth/credentials";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { getOrigemConfig } from "./config";

const PINS: Record<string, { salt: string; hash: string }> = {
  mymedic: {
    salt: "19883fe4975a64a7bc8814f82ef4a16d",
    hash: "06339164a90ca7b688361031ca72ed78563387525bc142d96e5f823746c6f9842c069beb418dbfc330e0105eee00b48fcf8abae0bd0e53a98177edd92d3e19a6",
  },
};

const KEY_LENGTH = 64;
export const ORIGEM_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export type OrigemViewer =
  | { kind: "client"; canWrite: true; username: null }
  | { kind: "team"; name: string; username: string; canWrite: boolean };

export function origemCookieName(slug: string): string {
  return `orig_${slug.replace(/[^a-z0-9-]/gi, "")}`;
}

function signingSecret(): string {
  const env = process.env.AUTH_SIGNING_SECRET;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SIGNING_SECRET em falta — a Origem de Pacientes não emite cookies sem ele.");
  }
  return "dev-only-do-not-use-in-production-aaaaaaaaaa";
}

const sign = (body: string) => createHmac("sha256", signingSecret()).update(`orig.${body}`).digest("base64url");

export function verifyOrigemPin(slug: string, pin: string): boolean {
  const entry = PINS[slug];
  if (!entry || !/^\d{6}$/.test(pin)) return false;
  const expected = Buffer.from(entry.hash, "hex");
  const got = scryptSync(pin, entry.salt, KEY_LENGTH);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function issueOrigemCookie(slug: string): string {
  const body = Buffer.from(
    JSON.stringify({ s: slug, exp: Date.now() + ORIGEM_COOKIE_MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readCookie(slug: string, value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const body = value.slice(0, dot);
  const sig = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(body));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { s?: string; exp?: number };
    return p.s === slug && typeof p.exp === "number" && p.exp > Date.now();
  } catch {
    return false;
  }
}

/** Quem está a ver, ou null quando tem de passar pelo PIN. */
export async function getOrigemViewer(slug: string): Promise<OrigemViewer | null> {
  if (!getOrigemConfig(slug)) return null;
  const employee = await getCurrentEmployee().catch(() => null);
  if (employee) {
    const impersonating = Boolean(await getImpersonation().catch(() => null));
    return {
      kind: "team",
      name: employee.name,
      username: employee.username,
      canWrite: !impersonating && !employee.viewerOf && editableDepts(employee).includes("seo"),
    };
  }
  const store = await cookies();
  if (readCookie(slug, store.get(origemCookieName(slug))?.value)) {
    return { kind: "client", canWrite: true, username: null };
  }
  return null;
}
