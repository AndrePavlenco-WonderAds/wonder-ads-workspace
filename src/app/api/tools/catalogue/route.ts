// Acrescentar uma app ao catálogo de /tools (só SuperAdmins).
//
// POST multipart/form-data: nome, categoria, descrição, link, cor, ajuste
// do logótipo, alias (separados por vírgulas) e, opcional, o ficheiro do
// logótipo — que vai para o Vercel Blob. Sem logótipo, o cartão mostra a
// inicial do nome sobre a cor escolhida.
//
// O portão é o isCurrentUserAdmin() daqui, não o botão escondido na UI:
// sessão tem-na toda a gente, e o middleware só verifica sessão.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import { makeToolId, sanitiseNewToolFields } from "@/lib/tools-catalogue";
import { isHttpUrl } from "@/lib/tools-access-store";
import {
  addCustomTool,
  takenToolIds,
  toolsCatalogueStorageConfigured,
} from "@/lib/tools-catalogue-store";

export const runtime = "nodejs";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function POST(req: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Só os SuperAdmins podem acrescentar apps." },
      { status: 403 },
    );
  }
  if (!toolsCatalogueStorageConfigured) {
    return NextResponse.json(
      { error: "Armazenamento indisponível — KV não está configurado." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const parsed = sanitiseNewToolFields({
    name: form.get("name"),
    category: form.get("category"),
    description: form.get("description"),
    url: form.get("url"),
    accent: form.get("accent"),
    logoFit: form.get("logoFit"),
    aliases: form.get("aliases"),
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  if (!isHttpUrl(parsed.fields.url)) {
    return NextResponse.json(
      { error: "O link tem de ser um endereço completo, a começar por https://" },
      { status: 400 },
    );
  }

  const file = form.get("logo");
  const hasLogo = file instanceof File && file.size > 0;
  if (hasLogo) {
    if (!LOGO_TYPES[file.type]) {
      return NextResponse.json(
        { error: "O logótipo tem de ser PNG, JPG, WebP, GIF ou SVG." },
        { status: 400 },
      );
    }
    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json(
        { error: "O logótipo não pode passar de 2 MB." },
        { status: 400 },
      );
    }
  }

  const id = makeToolId(parsed.fields.name, await takenToolIds());

  let logo: string | null = null;
  if (hasLogo) {
    try {
      const blob = await put(
        `tool-logos/${id}.${LOGO_TYPES[file.type]}`,
        file,
        { access: "public", contentType: file.type, addRandomSuffix: true },
      );
      logo = blob.url;
    } catch (err) {
      console.error("tool logo upload failed:", err);
      return NextResponse.json(
        { error: "Não foi possível carregar o logótipo." },
        { status: 502 },
      );
    }
  }

  const tool = { id, ...parsed.fields, logo, custom: true };
  await addCustomTool(tool);
  revalidatePath("/tools");
  return NextResponse.json({ tool });
}
