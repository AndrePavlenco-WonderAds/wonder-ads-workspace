// POST /api/reviews-hub/<slug>/auth — a password do cliente → cookie do hub.
// DELETE — sai (apaga o cookie). Tentativas erradas contam por IP no KV:
// 10 em 15 minutos e o portão fecha até a janela passar.

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import {
  HUB_COOKIE_MAX_AGE_SECONDS,
  hubCookieName,
  issueHubCookie,
  verifyHubPassword,
} from "@/lib/reviews-hub/access";
import { getHubConfig } from "@/lib/reviews-hub/config";
import { hubStoreConfigured } from "@/lib/reviews-hub/store";
import { readJson } from "@/lib/reviews-hub/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FAILS = 10;
const WINDOW_SECONDS = 15 * 60;

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!getHubConfig(slug)) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  const body = await readJson<{ password?: unknown }>(req);
  const password = typeof body?.password === "string" ? body.password : "";

  const failKey = `rhub:${slug}:auth-fail:${clientIp(req)}`;
  if (hubStoreConfigured) {
    const fails = Number((await kv.get<number>(failKey)) ?? 0);
    if (fails >= MAX_FAILS) {
      return NextResponse.json(
        { error: "Demasiadas tentativas. Tenta outra vez daqui a 15 minutos." },
        { status: 429 },
      );
    }
  }

  if (!verifyHubPassword(slug, password)) {
    if (hubStoreConfigured) {
      const n = await kv.incr(failKey);
      if (n === 1) await kv.expire(failKey, WINDOW_SECONDS);
    }
    return NextResponse.json({ error: "Password incorreta." }, { status: 401 });
  }

  if (hubStoreConfigured) await kv.del(failKey);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(hubCookieName(slug), issueHubCookie(slug), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HUB_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(hubCookieName(slug), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
