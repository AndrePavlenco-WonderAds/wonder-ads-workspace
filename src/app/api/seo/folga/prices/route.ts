// /api/seo/folga/prices — os preços de referência de cada categoria da Folga
// de custos (v78.50), iguais em todos os projetos.
//
//   PUT → grava a lista inteira {prices: {categoria: euros}} (só SuperAdmin)
//
// Sob /api/seo/*, fora do matcher do middleware: as verificações são feitas
// aqui, como em /api/seo/folga/[slug]. Este segmento fixo ganha ao [slug].

import { NextResponse } from "next/server";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { normalizeFolgaPrices } from "@/lib/seo-folga";
import { setFolgaPrices } from "@/lib/seo-folga-store";

export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function PUT(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return bad("Sessão inválida.", 401);
  if (await getImpersonation()) {
    return bad("Estás a ver a app como outra pessoa — esta vista é só de leitura.", 403);
  }
  if (!employee.isAdmin) return bad("Só a direção muda os preços de referência.", 403);

  let b: Record<string, unknown> | null = null;
  try {
    const raw = await req.json();
    b = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  } catch {
    b = null;
  }
  const prices = normalizeFolgaPrices(b?.prices);
  if (!prices) return bad("Os preços têm de ser valores de 0 € a 100.000 €.");

  const list = await setFolgaPrices(prices, { username: employee.username, name: employee.name });
  return NextResponse.json({ ok: true, list });
}
