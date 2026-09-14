// Remover uma app do catálogo de /tools (só SuperAdmins).
//
// As acrescentadas na página saem do KV, com o logótipo do Blob e as
// credenciais. As de base (em código) ficam escondidas — e as credenciais
// também se apagam, para uma password partilhada não sobreviver à app.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import { clearToolAccess } from "@/lib/tools-access-store";
import {
  removeTool,
  toolsCatalogueStorageConfigured,
} from "@/lib/tools-catalogue-store";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Só os SuperAdmins podem remover apps." },
      { status: 403 },
    );
  }
  if (!toolsCatalogueStorageConfigured) {
    return NextResponse.json(
      { error: "Armazenamento indisponível — KV não está configurado." },
      { status: 503 },
    );
  }

  const { id } = await ctx.params;
  const removed = await removeTool(id);
  if (!removed) {
    return NextResponse.json(
      { error: "Ferramenta desconhecida." },
      { status: 404 },
    );
  }

  await clearToolAccess(id);
  // Só os logótipos que a página carregou vivem no Blob; os de base estão
  // em /public e não se tocam.
  if (removed.custom && removed.logo?.includes(".blob.vercel-storage.com/")) {
    try {
      await del(removed.logo);
    } catch (err) {
      // Um ficheiro órfão no Blob não justifica falhar a remoção.
      console.error("tool logo delete failed:", err);
    }
  }

  revalidatePath("/tools");
  return NextResponse.json({ ok: true });
}
