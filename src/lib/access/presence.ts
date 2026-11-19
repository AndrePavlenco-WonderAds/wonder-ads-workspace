// Presença na app (v80.12) — registada no MIDDLEWARE, e por isso Edge-safe
// (fala com o Upstash por REST com `fetch`, como o portão em ./gate.ts).
//
// Antes (v80.11) a presença vinha do chip do nome, com `after()`: só contava
// as páginas que o mostram e cada instância do servidor guardava em memória
// quando tinha escrito pela última vez. Agora qualquer página aberta com
// sessão conta, seja a primeira abertura ou uma navegação dentro da app. Os
// prefetches, as APIs e os ficheiros não contam: uma aba esquecida aberta não
// faz ninguém parecer «na app».
//
// O ritmo das escritas vem de um cookie do próprio browser (`ws_seen`, com
// «pessoa.ms»): no máximo uma escrita a cada 5 minutos por pessoa e por
// browser, seja qual for a instância que responde. A escrita corre depois da
// resposta (`waitUntil`), por isso nunca atrasa a página, e se o KV falhar
// a página abre na mesma.

import type { NextRequest } from "next/server";
import {
  ACCESS_LAST_SEEN_KEY,
  ACCESS_VISIT_GAP_MS,
  ACCESS_VISITS_KEY,
  ACCESS_VISITS_MAX,
} from "./shared";

export const PRESENCE_COOKIE = "ws_seen";
const PRESENCE_THROTTLE_MS = 5 * 60 * 1000;
const PRESENCE_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;
const KV_TIMEOUT_MS = 2500;

/** Uma página aberta por uma pessoa: o documento, uma navegação dentro da app
 *  (pedido RSC) ou uma ação no ecrã (server action). */
export function isPresenceRequest(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) return false;
  // Ficheiros servidos sob as rotas internas (capas da Documentação, …).
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return false;
  const h = req.headers;
  if (h.get("next-router-prefetch") || h.get("purpose") === "prefetch") return false;
  if ((h.get("sec-purpose") ?? "").includes("prefetch")) return false;
  if (req.method === "GET") return true;
  return req.method === "POST" && Boolean(h.get("next-action"));
}

/** Ainda não é hora de escrever: o browser desta pessoa escreveu há menos de
 *  5 minutos. O cookie guarda quem foi, para uma troca de conta no mesmo
 *  browser contar logo. */
export function presenceIsFresh(req: NextRequest, username: string, now: number): boolean {
  const raw = req.cookies.get(PRESENCE_COOKIE)?.value ?? "";
  const dot = raw.lastIndexOf(".");
  if (dot <= 0 || raw.slice(0, dot) !== username) return false;
  const at = Number(raw.slice(dot + 1));
  return Number.isFinite(at) && now - at >= 0 && now - at < PRESENCE_THROTTLE_MS;
}

export function presenceCookie(username: string, now: number) {
  return {
    name: PRESENCE_COOKIE,
    value: `${username}.${now}`,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PRESENCE_COOKIE_MAX_AGE_S,
  };
}

function kvWriteEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function kvPost(env: { url: string; token: string }, path: string, body: unknown): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.url}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`KV ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
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

/** Grava a presença. Se a pessoa esteve fora 30 minutos ou mais, é uma
 *  «entrada» nova no registo. Melhor esforço: nunca lança. */
export async function writePresence(username: string, now: number): Promise<void> {
  const env = kvWriteEnv();
  if (!env || !username) return;
  try {
    const prevRes = (await kvPost(env, "", ["HGET", ACCESS_LAST_SEEN_KEY, username])) as { result?: unknown };
    const prev = atOf(prevRes?.result ?? null);
    const commands: string[][] = [["HSET", ACCESS_LAST_SEEN_KEY, username, JSON.stringify({ at: now })]];
    if (!prev || now - prev >= ACCESS_VISIT_GAP_MS) {
      const visit = { id: crypto.randomUUID(), username, at: now, kind: "entrada" };
      commands.push(["LPUSH", ACCESS_VISITS_KEY, JSON.stringify(visit)]);
      commands.push(["LTRIM", ACCESS_VISITS_KEY, "0", String(ACCESS_VISITS_MAX - 1)]);
    }
    await kvPost(env, "/pipeline", commands);
  } catch {
    /* sem registo desta vez */
  }
}
