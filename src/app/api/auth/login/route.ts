// POST /api/auth/login — verifies an employee's username + password
// against `src/lib/auth/credentials.ts` (scrypt) and issues a 48h
// HMAC-signed session cookie. DELETE /api/auth/login logs out by
// expiring the same cookie.
//
// Node runtime (default): scrypt isn't available in Edge. Middleware
// only ever VERIFIES the cookie (HMAC via WebCrypto), it never has to
// hash a password.

import { after, NextResponse } from "next/server";
import { verifyLoginLive } from "@/lib/access/login";
import { recordLogin } from "@/lib/access/store";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  issueSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const username =
    typeof (body as { username?: unknown })?.username === "string"
      ? ((body as { username: string }).username as string)
      : "";
  const password =
    typeof (body as { password?: unknown })?.password === "string"
      ? ((body as { password: string }).password as string)
      : "";
  if (!username.trim() || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }
  // v78.72: a password do cofre (regenerada em /admin/acessos) ganha à do
  // código, e um acesso cancelado não entra — ver lib/access/login.ts.
  const check = await verifyLoginLive(username, password);
  if (!check.ok && check.reason === "revoked") {
    return NextResponse.json(
      { error: "Este acesso foi cancelado. Fala com a direção." },
      { status: 403 },
    );
  }
  const verifiedUsername = check.ok ? check.username : null;
  if (!verifiedUsername) {
    // Same response for unknown user + wrong password so the gate
    // doesn't help an attacker enumerate accounts.
    return NextResponse.json(
      { error: "Wrong username or password." },
      { status: 401 },
    );
  }
  const { cookieValue, payload } = await issueSession(verifiedUsername);
  // «Último login» na consola de acessos — depois da resposta, nunca a atrasa.
  after(() => recordLogin(verifiedUsername));
  const res = NextResponse.json({
    ok: true,
    username: verifiedUsername,
    expiresAt: payload.exp,
  });
  res.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
