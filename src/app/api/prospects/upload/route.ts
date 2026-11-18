// Token de upload para os anexos da Ficha do prospect (v80.0).
//
// O ficheiro sobe direto do browser para o Blob (sem o limite de body da
// função); esta rota só emite o token, e só a quem pode escrever nas fichas.
// É uma rota própria — e não /api/files/upload — porque os comerciais são
// viewers do SEO e o middleware recusa-lhes escritas fora de /api/prospects.
//
// Sem `onUploadCompleted`: assim o Blob não chama de volta esta rota (a
// chamada vinha sem sessão e batia no login). A ficha guarda o URL quando o
// browser grava a nota ou o anexo.

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";
import { effectiveUsername, isImpersonating } from "@/lib/auth/session";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { canWriteProspects } from "@/lib/prospects/access";
import { LIMITS } from "@/lib/prospects/shared";

export const runtime = "nodejs";

const ALLOWED_CONTENT_TYPES = ["image/*", "video/*", "audio/*", "application/*", "text/*"];

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession();
  const username = effectiveUsername(session);
  const row = username ? findEmployeeByUsername(username) : null;
  if (!row || isImpersonating(session) || !canWriteProspects(row)) {
    return NextResponse.json({ error: "Sem permissão para anexar ficheiros." }, { status: 403 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("prospects/")) throw new Error("Caminho inválido.");
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: LIMITS.maxUploadBytes,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload falhou." },
      { status: 400 },
    );
  }
}
