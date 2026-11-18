// API da Ficha do prospect (v80.0).
//
//   GET  → a ficha + quem já a leu (toda a gente com sessão)
//   POST → uma operação (`ProspectOp`) — quem pode escrever (ver access.ts)
//
// O middleware deixa passar os viewers comerciais SÓ aqui e em /prospects;
// a autorização a sério vive nesta rota, com a sessão lida de novo.

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";
import { effectiveUsername, isImpersonating } from "@/lib/auth/session";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { canWriteProspects, prospectPeople } from "@/lib/prospects/access";
import { resolveProspectContext } from "@/lib/prospects/context";
import {
  applyToProspectFile,
  getProspectFile,
  getProspectReads,
} from "@/lib/prospects/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getCurrentSession();
  const username = effectiveUsername(session);
  if (!username || !findEmployeeByUsername(username)) {
    return json({ error: "Sessão expirada." }, 401);
  }
  if (!SLUG_RE.test(slug)) return json({ error: "Ficha desconhecida." }, 404);
  const { file, failed } = await getProspectFile(slug);
  if (failed) return json({ error: "Não foi possível ler a ficha." }, 503);
  return json({ file, reads: await getProspectReads(slug) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getCurrentSession();
  const username = effectiveUsername(session);
  const row = username ? findEmployeeByUsername(username) : null;
  if (!username || !row) return json({ error: "Sessão expirada — volta a entrar." }, 401);
  if (isImpersonating(session)) {
    return json({ error: "Estás a ver a app como outra pessoa — esta vista é só de leitura." }, 403);
  }
  if (!canWriteProspects(row)) {
    return json({ error: "O teu perfil só pode ler as fichas." }, 403);
  }
  if (!SLUG_RE.test(slug)) return json({ error: "Ficha desconhecida." }, 404);

  let op: unknown;
  try {
    op = await req.json();
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }

  // A ficha só existe para clientes da board, onboardings e fichas já
  // gravadas — nunca para um slug inventado.
  const existing = await getProspectFile(slug);
  if (existing.failed) return json({ error: "Não foi possível ler a ficha — tenta outra vez." }, 503);
  const ctx = await resolveProspectContext(slug, existing.file?.title);
  if (!ctx) return json({ error: "Ficha desconhecida." }, 404);

  const validOwners = new Set(prospectPeople().filter((p) => p.canOwn).map((p) => p.username));
  try {
    const result = await applyToProspectFile(
      slug,
      op,
      { username, isAdmin: Boolean(row.isAdmin) },
      { title: ctx.title },
      validOwners,
    );
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ file: result.file });
  } catch (err) {
    console.error("prospect write failed:", err);
    return json({ error: "Não foi possível gravar — tenta outra vez." }, 500);
  }
}
