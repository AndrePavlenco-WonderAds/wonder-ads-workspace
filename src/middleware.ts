// Workspace login gate.
//
// Sits in front of every INTERNAL workspace route. Verifies the HMAC
// session cookie issued by /api/auth/login; redirects to /login when
// missing, tampered, or expired (48h). Carries the original path as
// `?next=` so the user lands back where they were going after sign-in.
//
// Public surfaces are NOT matched by `config.matcher` below:
//   • /(public-review)/[slug]/...  — client-facing approval pages
//   • /api/reviews/...             — the public review API
//   • /login + /api/auth/...        — the gate itself
//   • /_next/*, /favicon.ico, /static — assets
// → They never reach this middleware.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSession(cookie);
  if (session) return NextResponse.next();
  // Build the bounce URL with the original path + search preserved.
  const url = req.nextUrl.clone();
  const original = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(original)}`;
  const res = NextResponse.redirect(url);
  // Clean up any half-baked cookie so a tampered or expired token
  // doesn't just keep bouncing the user.
  if (cookie) {
    res.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}

export const config = {
  matcher: [
    // Department chooser + every internal dashboard.
    "/",
    "/seo/:path*",
    "/ads/:path*",
    "/web/:path*",
    "/commercial/:path*",
    "/admin/:path*",
    "/changelog/:path*",
    // Internal-only API surfaces. /api/reviews stays public (clients
    // hit it from the (public-review) pages), /api/auth is the gate
    // itself, /api/files is used by both sides so we leave it open
    // and rely on the per-blob token model that's already there.
    // (The legacy /api/admin-auth + /api/changelog-auth endpoints
    //  were removed in v74.23 — session-based gating handles both.)
    "/api/admin/:path*",
    "/api/call-notes/:path*",
    "/api/roadmaps/:path*",
    "/api/seo-actions/:path*",
    "/api/onboarding/:path*",
    "/api/keywords/:path*",
    "/api/target-keywords/:path*",
    "/api/briefs/:path*",
    "/api/quick-actions/:path*",
    "/api/accesses/:path*",
    "/api/diagnostics/:path*",
    "/api/ga4/:path*",
    "/api/chat/:path*",
  ],
};
