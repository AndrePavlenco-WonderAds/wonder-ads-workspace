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
import {
  canEditDept,
  viewerDeptOf,
  type DeptSlug,
} from "@/lib/auth/credentials";

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

// As rotas internas — o espelho do `config.matcher` antigo. O matcher
// passou a apanhar TODO o /api (v77.32) só para o portão dos viewers ver
// também as APIs que nunca passaram por aqui (/api/ads, /api/seo, …). Para
// toda a gente que não é viewer, um caminho fora desta lista continua a
// passar sem sessão e sem gates, exatamente como antes.
const INTERNAL_PREFIXES = [
  "/seo",
  "/ads",
  "/web",
  "/commercial",
  "/admin",
  "/changelog",
  "/formacao",
  "/ausencias",
  "/tools",
  "/medalhas",
  "/api/absences",
  "/api/tools",
  "/api/medalhas",
  "/api/commercial",
  "/api/admin",
  "/api/web",
  "/api/call-notes",
  "/api/roadmaps",
  "/api/seo-actions",
  "/api/reports",
  "/api/onboarding",
  "/api/keywords",
  "/api/target-keywords",
  "/api/briefs",
  "/api/quick-actions",
  "/api/accesses",
  "/api/diagnostics",
  "/api/ga4",
  "/api/chat",
  "/api/formacao",
];

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isInternalPath(pathname: string): boolean {
  return (
    pathname === "/" || INTERNAL_PREFIXES.some((p) => underPrefix(pathname, p))
  );
}

// PERFIL VIEWER (v77.32) — as APIs que cada departamento LÊ. Tudo o que não
// está aqui é recusado a um viewer, mesmo em GET: é uma lista de portas
// abertas, não de portas fechadas, para uma API nova nascer fechada.
// De fora de propósito: /api/accesses (o cofre de acessos dos clientes),
// /api/tools (as passwords da agência) e qualquer «/reveal».
const VIEWER_READ_APIS: Record<DeptSlug, string[]> = {
  seo: [
    "/api/roadmaps",
    "/api/seo-actions",
    "/api/briefs",
    "/api/onboarding",
    "/api/onboarding-progress",
    "/api/onboarding-files",
    "/api/target-keywords",
    "/api/quick-actions",
    "/api/call-notes",
    "/api/reports",
    "/api/keywords",
    "/api/diagnostics",
    "/api/ga4",
    "/api/nps",
    "/api/seranking",
    "/api/kw-backtest",
    "/api/seo",
    "/api/seo-directories",
    "/api/files",
  ],
  ads: ["/api/ads", "/api/files"],
  web: ["/api/web", "/api/files"],
  commercial: ["/api/commercial", "/api/proposals", "/api/files"],
};

/** O portão dos viewers: nenhuma escrita, só as páginas e as APIs de leitura
 *  do seu departamento. Devolve a resposta de bloqueio, ou null para seguir. */
function viewerGate(req: NextRequest, dept: DeptSlug): NextResponse | null {
  const { pathname } = req.nextUrl;
  // Login, logout e o «voltar a ser eu» do SuperAdmin a ver como o viewer.
  if (underPrefix(pathname, "/api/auth")) return null;

  // Nenhuma escrita, em caminho nenhum — também numa página (uma server
  // action faz POST ao próprio URL da página, não a /api).
  if (WRITE_METHODS.has(req.method)) {
    return NextResponse.json(
      { error: "Acesso só de leitura — este perfil não pode fazer alterações." },
      { status: 403 },
    );
  }

  if (pathname.startsWith("/api/")) {
    const allowed =
      !pathname.includes("/reveal") &&
      VIEWER_READ_APIS[dept].some((p) => underPrefix(pathname, p));
    return allowed
      ? null
      : NextResponse.json(
          { error: "Este perfil não tem acesso a esta área." },
          { status: 403 },
        );
  }

  // Páginas: só as do próprio departamento. O seletor de departamentos, as
  // Tools, as Medalhas, a Formação, o /admin… devolvem-no a casa.
  if (underPrefix(pathname, `/${dept}`)) return null;
  const url = req.nextUrl.clone();
  url.pathname = `/${dept}`;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSession(cookie);
  const internal = isInternalPath(req.nextUrl.pathname);
  if (session) {
    const viewerDept = viewerDeptOf(effectiveUsername(session));
    if (viewerDept) {
      const blocked = viewerGate(req, viewerDept);
      if (blocked) return blocked;
    }
    // Fora das rotas internas nada mais se aplica — é o comportamento de
    // sempre destes caminhos.
    if (!internal) return NextResponse.next();
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
    // O mesmo portão para o Comercial (v77.12): quem só pode VER o
    // departamento não muda o tipo de uma proposta nem regista decisões.
    if (
      WRITE_METHODS.has(req.method) &&
      req.nextUrl.pathname.startsWith("/api/commercial") &&
      !canEditDept(effectiveUsername(session), "commercial")
    ) {
      return NextResponse.json(
        { error: "Acesso só de leitura — não podes alterar propostas no departamento Comercial." },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }
  // Sem sessão, um caminho público (/api/reviews, /api/cron, /api/slack…)
  // segue como sempre seguiu.
  if (!internal) return NextResponse.next();
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
    // Ausências — a folha de pedido + histórico do próprio. Toda a gente
    // com sessão; a decisão vive em /admin/ausencias (gate isAdmin) e a
    // API de decisão volta a verificar. NOTA: /api/slack fica DE FORA do
    // matcher de propósito — quem lá bate é o Slack, autenticado pela
    // assinatura HMAC do próprio payload, não por cookie de sessão.
    "/ausencias/:path*",
    "/api/absences/:path*",
    // Tools — os acessos das ferramentas da agência. Toda a gente com
    // sessão VÊ; só o SuperAdmin escreve, e esse gate vive na própria
    // rota da API (isCurrentUserAdmin), não aqui.
    "/tools/:path*",
    "/api/tools/:path*",
    // Medalhas — a galeria da própria pessoa e a escolha das três do
    // header. Sessão para tudo; a API recusa escrever com «Ver como».
    "/medalhas/:path*",
    "/api/medalhas/:path*",
    // Comercial — templates, upload e decisões das propostas. Sessão para
    // tudo; a escrita exige poder editar o departamento (gate abaixo).
    "/api/commercial/:path*",
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
    // Todo o resto do /api — SÓ para o portão dos viewers (v77.32). Sem
    // sessão, ou com sessão de quem não é viewer, estes caminhos seguem sem
    // gates (ver isInternalPath).
    "/api/:path*",
  ],
};
