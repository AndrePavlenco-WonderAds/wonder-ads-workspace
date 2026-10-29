// /api/documentacao/[doc]/sugestao — uma sugestão à direção sobre uma lista
// de Protocolos (v78.51): Obrigatórios, Recomendados ou Proibidos.
//
//   POST { text } → guarda a sugestão; a direção vê-a no sino.
//
// Fora do matcher do middleware: tudo é verificado aqui. Escreve quem pode
// LER a página (a Documentação aberta para ele e o bloco no seu público), na
// própria sessão — com «Ver como», a sugestão ficava assinada por outra pessoa.

import { NextResponse } from "next/server";
import { getImpersonation } from "@/lib/auth/server";
import { MAX_SUGGESTION_CHARS, PROTOCOL_META, protocolListOfDoc } from "@/lib/documentacao/protocolos";
import { addProtocolSuggestion } from "@/lib/documentacao/protocol-suggestions";
import { getDocsContext } from "@/lib/documentacao/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ doc: string }> };

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request, { params }: Ctx) {
  const { doc } = await params;
  const list = protocolListOfDoc(doc);
  if (!list) return bad("Página desconhecida.", 404);

  if (await getImpersonation()) return bad("Estás a ver a app como outra pessoa — esta vista é só de leitura.", 403);
  const ctx = await getDocsContext(PROTOCOL_META[list].blockId);
  if (ctx.state === "no-session") return bad("Sessão inválida.", 401);
  if (ctx.state !== "ok") return bad("Esta página não está aberta para ti.", 403);

  let text = "";
  try {
    const body = (await req.json()) as Record<string, unknown>;
    text = typeof body.text === "string" ? body.text.replace(/\r\n?/g, "\n").trim() : "";
  } catch {
    return bad("Pedido inválido.");
  }
  if (text.length < 5) return bad("Escreve a tua sugestão (pelo menos 5 caracteres).");
  if (text.length > MAX_SUGGESTION_CHARS) return bad(`A sugestão tem de ter até ${MAX_SUGGESTION_CHARS} caracteres.`);

  await addProtocolSuggestion({ list, username: ctx.reader.username, name: ctx.reader.name, text });
  return NextResponse.json({ ok: true });
}
