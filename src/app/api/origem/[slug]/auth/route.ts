// POST /api/origem/<slug>/auth — o PIN do cliente → cookie da página.
// DELETE — sai. Tentativas erradas contam por IP: 10 em 15 minutos e o
// portão fecha até a janela passar.

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import {
  ORIGEM_COOKIE_MAX_AGE_SECONDS,
  issueOrigemCookie,
  origemCookieName,
  verifyOrigemPin,
} from "@/lib/origem/access";
import { getOrigemConfig } from "@/lib/origem/config";
import { clientIp, readJson } from "@/lib/origem/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FAILS = 10;
const WINDOW_SECONDS = 15 * 60;
const kvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  if (!getOrigemConfig(slug)) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const body = await readJson<{ pin?: unknown }>(req);
  const pin = typeof body?.pin === "string" ? body.pin.replace(/\D/g, "") : "";

  const failKey = `origem:${slug}:auth-fail:${clientIp(req)}`;
  if (kvConfigured) {
    const fails = Number((await kv.get<number>(failKey)) ?? 0);
    if (fails >= MAX_FAILS) {
      return NextResponse.json({ error: "Demasiadas tentativas. Tente outra vez daqui a 15 minutos." }, { status: 429 });
    }
  }
  if (!verifyOrigemPin(slug, pin)) {
    if (kvConfigured) {
      const n = await kv.incr(failKey);
      if (n === 1) await kv.expire(failKey, WINDOW_SECONDS);
    }
    return NextResponse.json({ error: "PIN incorreto." }, { status: 401 });
  }
  if (kvConfigured) await kv.del(failKey);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(origemCookieName(slug), issueOrigemCookie(slug), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ORIGEM_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(origemCookieName(slug), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
