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
import {
  SESSION_COOKIE,
  effectiveUsername,
  isImpersonating,
  readSession,
} from "@/lib/auth/session";
import { canEditDept } from "@/lib/auth/credentials";

// Mutating HTTP methods — a request using one of these is trying to
// CHANGE something, so it must clear the per-dept write-gate below.
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// API path prefixes that live under the SEO department. A write request
// (POST/PUT/PATCH/DELETE) to any of these must come from a user who may
// EDIT the SEO dept — Web designers get read-only SEO access, so their
// writes are rejected here regardless of which UI control fired them.
// GET/HEAD are always allowed (reads + downloads of existing outputs).
const SEO_WRITE_PREFIXES = [
  "/api/roadmaps",
  "/api/seo-actions",
  "/api/briefs",
  "/api/onboarding",
  "/api/target-keywords",
  "/api/quick-actions",
  "/api/accesses",
  "/api/call-notes",
  "/api/chat",
];

export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSession(cookie);
  if (session) {
    // «VER COMO» É SÓ DE LEITURA. Um SuperAdmin a espreitar a app de um
    // consultor não pode escrever nada — nem sem querer. Se pudesse, o
    // trabalho ficava assinado por quem não o fez: um roadmap alterado, uma
    // ação aprovada, uma nota gravada, tudo com o nome da outra pessoa e
    // sem rasto de quem lá mexeu. O objetivo do «ver como» é VER, e o
    // bloqueio vive aqui — no servidor, à frente de todas as rotas
    // internas — para não depender de nenhum botão estar escondido.
    if (WRITE_METHODS.has(req.method) && isImpersonating(session)) {
      return NextResponse.json(
        {
          error:
            "Estás a ver a app como outra pessoa — esta vista é só de leitura. Volta ao teu utilizador para fazer alterações.",
        },
        { status: 403 },
      );
    }
    // Read-only enforcement: block SEO writes from users who may view
    // but not edit the SEO department (Web designers). This is the
    // single server-side backstop — it does not depend on any UI
    // control being hidden.
    if (
      WRITE_METHODS.has(req.method) &&
      SEO_WRITE_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p)) &&
      !canEditDept(effectiveUsername(session), "seo")
    ) {
      return NextResponse.json(
        { error: "Read-only access — you cannot make changes in the SEO department." },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }
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
    // Formação interna — universidade dos consultores. Toda a gente com
    // sessão entra; o gate de /formacao/admin é feito no layout (isAdmin).
    "/formacao/:path*",
    // Internal-only API surfaces. /api/reviews stays public (clients
    // hit it from the (public-review) pages), /api/auth is the gate
    // itself, /api/files is used by both sides so we leave it open
    // and rely on the per-blob token model that's already there.
    // (The legacy /api/admin-auth + /api/changelog-auth endpoints
    //  were removed in v74.23 — session-based gating handles both.)
    "/api/admin/:path*",
    "/api/web/:path*",
    "/api/call-notes/:path*",
    "/api/roadmaps/:path*",
    "/api/seo-actions/:path*",
    "/api/reports/:path*",
    "/api/onboarding/:path*",
    "/api/keywords/:path*",
    "/api/target-keywords/:path*",
    "/api/briefs/:path*",
    "/api/quick-actions/:path*",
    "/api/accesses/:path*",
    "/api/diagnostics/:path*",
    "/api/ga4/:path*",
    "/api/chat/:path*",
    "/api/formacao/:path*",
  ],
};
