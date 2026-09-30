// Quem pode abrir o Reviews Hub de um cliente:
//   • o cliente — com a password da plataforma, que emite um cookie próprio
//     (`rhub_<slug>`, HMAC com o mesmo AUTH_SIGNING_SECRET da app, 30 dias);
//   • a equipa Wonder Ads — qualquer sessão válida do workspace entra direto,
//     sem password. Escreve quem pode editar o SEO; os restantes (viewers,
//     Web, «ver como») entram só para ver.
//
// Node runtime (scrypt + createHmac). Nada disto passa pelo middleware: a
// página e as APIs do hub são públicas no matcher e fazem a verificação aqui.

import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { editableDepts } from "@/lib/auth/credentials";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { getHubConfig } from "./config";
import type { HubViewer } from "./types";

const KEY_LENGTH = 64;
export const HUB_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function hubCookieName(slug: string): string {
  return `rhub_${slug.replace(/[^a-z0-9-]/gi, "")}`;
}

function signingSecret(): string {
  const env = process.env.AUTH_SIGNING_SECRET;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SIGNING_SECRET em falta — o Reviews Hub não emite cookies sem ele.");
  }
  return "dev-only-do-not-use-in-production-aaaaaaaaaa";
}

function sign(body: string): string {
  return createHmac("sha256", signingSecret()).update(`rhub.${body}`).digest("base64url");
}

/** Verifica a password do cliente em tempo constante. */
export function verifyHubPassword(slug: string, password: string): boolean {
  const cfg = getHubConfig(slug);
  if (!cfg || !password) return false;
  const expected = Buffer.from(cfg.passwordHash, "hex");
  const got = scryptSync(password, cfg.passwordSalt, KEY_LENGTH);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function issueHubCookie(slug: string): string {
  const body = Buffer.from(
    JSON.stringify({ s: slug, exp: Date.now() + HUB_COOKIE_MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readHubCookie(slug: string, value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const body = value.slice(0, dot);
  const sig = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(body));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      s?: string;
      exp?: number;
    };
    return payload.s === slug && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

/** Quem está a ver, ou null quando tem de passar pela password. */
export async function getHubViewer(slug: string): Promise<HubViewer | null> {
  if (!getHubConfig(slug)) return null;
  const employee = await getCurrentEmployee().catch(() => null);
  if (employee) {
    // As mesmas regras do SEO: escreve quem edita o departamento, e o «ver
    // como» de um SuperAdmin é sempre só leitura.
    const impersonating = Boolean(await getImpersonation().catch(() => null));
    return {
      kind: "team",
      name: employee.name,
      canWrite: !impersonating && editableDepts(employee).includes("seo"),
    };
  }
  const store = await cookies();
  if (readHubCookie(slug, store.get(hubCookieName(slug))?.value)) {
    return { kind: "client", canWrite: true };
  }
  return null;
}

/** Nome que fica no registo de atividade. */
export function viewerLabel(viewer: HubViewer, brand: string): string {
  return viewer.kind === "team" ? `${viewer.name} (Wonder Ads)` : brand;
}
