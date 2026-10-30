// /api/documentacao/[doc] — grava uma página editável da Documentação (v78.46):
// a Jornada de Cliente e as listas de Protocolos Obrigatórios, Recomendados e
// Proibidos.
//
//   PUT { data, base } → substitui o documento inteiro. `base` é o
//   `updatedAt` que a página tinha quando o abriu: se entretanto outra pessoa
//   gravou, devolve 409 com a versão atual em vez de a pisar.
//
// Fora do matcher do middleware: tudo é verificado aqui. Só um SuperAdmin, na
// própria sessão (com «Ver como» é só leitura) e com a Documentação aberta
// para ele.

import { NextResponse } from "next/server";
import { getCurrentEmployee, getCurrentSession, getImpersonation } from "@/lib/auth/server";
import { docsAvailable } from "@/lib/documentacao/access";
import { normalizeJourney } from "@/lib/documentacao/jornada";
import { normalizeProtocols, protocolListOfDoc } from "@/lib/documentacao/protocolos";
import { getJourney, getProtocols, saveJourney, saveProtocols } from "@/lib/documentacao/editable-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ doc: string }> };

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function PUT(req: Request, { params }: Ctx) {
  const { doc } = await params;
  const list = protocolListOfDoc(doc);
  if (doc !== "jornada-cliente" && !list) return bad("Página desconhecida.", 404);

  const [session, employee] = await Promise.all([getCurrentSession(), getCurrentEmployee()]);
  if (!session || !employee) return bad("Sessão inválida.", 401);
  if (await getImpersonation()) return bad("Estás a ver a app como outra pessoa — esta vista é só de leitura.", 403);
  if (!employee.isAdmin || !docsAvailable(session.u)) return bad("Só a direção edita esta página.", 403);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Pedido inválido.");
  }
  const base = typeof body.base === "number" ? body.base : -1;

  if (doc === "jornada-cliente") {
    const clean = normalizeJourney(body.data);
    if (!clean) return bad("Cada tarefa precisa de um título.");
    const current = await getJourney();
    if (current.updatedAt !== base) {
      return NextResponse.json({ error: "Alguém mudou a jornada entretanto. Recarrega a página.", current }, { status: 409 });
    }
    return NextResponse.json({ data: await saveJourney(clean, employee.name) });
  }

  if (!list) return bad("Página desconhecida.", 404);
  const clean = normalizeProtocols(body.data);
  if (!clean) return bad("Cada protocolo precisa de um título.");
  const current = await getProtocols(list);
  if (current.updatedAt !== base) {
    return NextResponse.json({ error: "Alguém mudou esta lista entretanto. Recarrega a página.", current }, { status: 409 });
  }
  return NextResponse.json({ data: await saveProtocols(list, clean, employee.name) });
}
