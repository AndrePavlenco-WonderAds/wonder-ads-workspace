// Escrita das credenciais das ferramentas (/tools).
//
// PUT grava o username + password de uma ferramenta; DELETE limpa-os.
//
// DOIS PORTÕES, DE PROPÓSITO. O middleware já exige sessão para
// /api/tools/* — mas sessão TEM toda a gente, e esta página é de leitura
// para toda a gente menos os SuperAdmins. O portão que interessa é o
// isCurrentUserAdmin() daqui: é ele que impede um consultor de trocar a
// password do SemRush com um `fetch` na consola. Esconder o lápis no
// cartão é só cortesia.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee, isCurrentUserAdmin } from "@/lib/auth/server";
import { getWorkspaceTool } from "@/lib/tools-catalogue";
import {
  clearToolAccess,
  isHttpUrl,
  sanitiseToolAccessBody,
  saveToolAccess,
  toolsAccessStorageConfigured,
} from "@/lib/tools-access-store";

export const runtime = "nodejs";

async function guard(id: string): Promise<
  | { ok: true; by: string }
  | { ok: false; res: NextResponse }
> {
  if (!(await isCurrentUserAdmin())) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Só os SuperAdmins podem editar acessos." },
        { status: 403 },
      ),
    };
  }
  if (!getWorkspaceTool(id)) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Ferramenta desconhecida." },
        { status: 404 },
      ),
    };
  }
  if (!toolsAccessStorageConfigured) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Armazenamento indisponível — KV não está configurado." },
        { status: 503 },
      ),
    };
  }
  const me = await getCurrentEmployee();
  return { ok: true, by: me?.name ?? "SuperAdmin" };
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const g = await guard(id);
  if (!g.ok) return g.res;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  // Um link mal escrito não pode ser engolido em silêncio — o SuperAdmin
  // gravava «semrush.com/login», o cartão abria o site da ferramenta na
  // mesma, e ninguém percebia porquê.
  const rawUrl =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>).loginUrl
      : undefined;
  if (typeof rawUrl === "string" && rawUrl.trim() && !isHttpUrl(rawUrl.trim())) {
    return NextResponse.json(
      { error: "O link de login tem de ser um endereço completo, a começar por https://" },
      { status: 400 },
    );
  }
  const body = sanitiseToolAccessBody(raw);
  const entry = await saveToolAccess(id, body, g.by);
  revalidatePath("/tools");
  return NextResponse.json({ entry });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const g = await guard(id);
  if (!g.ok) return g.res;

  await clearToolAccess(id);
  revalidatePath("/tools");
  return NextResponse.json({ ok: true });
}
