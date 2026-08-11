// PUT /api/seo/renewal/[slug] — grava a data de renovação e o período do
// contrato de um cliente.
//
// Sob /api/seo/*, que NÃO está no matcher do middleware — por isso o
// write-gate do departamento não corre aqui e a verificação de permissão é
// feita nesta rota, à mão: só quem pode EDITAR o departamento de SEO grava
// (um designer de Web abre a página do cliente mas não mexe em datas de
// contrato). O mesmo modelo das outras rotas fora do matcher.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { canEditDept } from "@/lib/auth/credentials";
import {
  RENEWAL_TERMS,
  saveClientRenewal,
} from "@/lib/client-renewal-store";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!canEditDept(employee.username, "seo")) {
    return NextResponse.json(
      { error: "Só de leitura — não podes alterar dados do departamento SEO." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const patch: { renewalDate?: string | null; termMonths?: number } = {};
  if ("renewalDate" in b) {
    const v = b.renewalDate;
    if (v === null || v === "") {
      patch.renewalDate = null;
    } else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      patch.renewalDate = v;
    } else {
      return NextResponse.json(
        { error: "Data de renovação inválida." },
        { status: 400 },
      );
    }
  }
  if ("termMonths" in b) {
    const v = b.termMonths;
    if (
      typeof v !== "number" ||
      !(RENEWAL_TERMS as readonly number[]).includes(v)
    ) {
      return NextResponse.json(
        { error: "Período tem de ser 3, 6, 9 ou 12 meses." },
        { status: 400 },
      );
    }
    patch.termMonths = v;
  }

  try {
    const saved = await saveClientRenewal(slug, patch, employee.name);
    return NextResponse.json({ ok: true, renewal: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
