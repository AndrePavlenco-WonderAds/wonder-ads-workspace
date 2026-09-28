// Escrita das credenciais das ferramentas (/tools).
//
// PUT grava o username + password de uma ferramenta; DELETE limpa-os.
//
// QUEM PODE O QUÊ (v77.50). O PUT é de toda a equipa com sessão: quem
// muda a password de uma ferramenta atualiza-a logo no cartão, sem ter de
// pedir a um SuperAdmin — e o cartão guarda quem gravou e quando. Os
// viewers ficam de fora (só leitura; o middleware já lhes recusa escritas
// e este portão repete-o). O DELETE — limpar o cartão inteiro — continua
// só SuperAdmin.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee, isCurrentUserAdmin } from "@/lib/auth/server";
import { getWorkspaceToolById } from "@/lib/tools-catalogue-store";
import {
  clearToolAccess,
  isHttpUrl,
  sanitiseToolAccessBody,
  saveToolAccess,
  toolsAccessStorageConfigured,
} from "@/lib/tools-access-store";

export const runtime = "nodejs";

async function guard(
  id: string,
  adminOnly: boolean,
): Promise<
  | { ok: true; by: string }
  | { ok: false; res: NextResponse }
> {
  const me = await getCurrentEmployee();
  const isAdmin = await isCurrentUserAdmin();
  if (!me || (adminOnly ? !isAdmin : !isAdmin && me.viewerOf)) {
    return {
      ok: false,
      res: NextResponse.json(
        {
          error: adminOnly
            ? "Só os SuperAdmins podem limpar acessos."
            : "Este perfil é só de leitura.",
        },
        { status: 403 },
      ),
    };
  }
  if (!(await getWorkspaceToolById(id))) {
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
  return { ok: true, by: me.name };
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const g = await guard(id, false);
  if (!g.ok) return g.res;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  // Um link mal escrito não pode ser engolido em silêncio — gravava-se
  // «semrush.com/login», o cartão abria o site da ferramenta na
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
  const g = await guard(id, true);
  if (!g.ok) return g.res;

  await clearToolAccess(id);
  revalidatePath("/tools");
  return NextResponse.json({ ok: true });
}
