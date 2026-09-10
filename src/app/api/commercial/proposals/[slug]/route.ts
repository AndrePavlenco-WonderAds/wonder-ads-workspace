// PATCH /api/commercial/proposals/[slug] — edita o tipo (Renovação ↔
// Cross-sell), regista a resposta do cliente (`decision: "aceite" |
// "recusada"` marca, `decision: null` anula → «enviada») e/ou escreve o
// valor total em € por cima (`valueEur: number`, `null` limpa).
// DELETE apaga uma proposta carregada por upload (as de código são do git).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isProposalKind } from "@/lib/proposals";
import {
  getProposalRecord,
  removeUploadedProposal,
  setProposalDecision,
  setProposalKind,
  setProposalValue,
} from "@/lib/proposals/store";
import { sanitizeValueEur } from "@/lib/proposals/value";
import { guardCommercialWrite } from "@/lib/proposals/api-guard";

export const runtime = "nodejs";

function bump(slug: string, clientSlug: string | null) {
  revalidatePath("/commercial");
  revalidatePath(`/proposta/${slug}`);
  if (clientSlug) revalidatePath(`/seo/${clientSlug}`);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const g = await guardCommercialWrite();
  if (!g.ok) return g.res;
  const { slug } = await ctx.params;
  const record = await getProposalRecord(slug);
  if (!record) {
    return NextResponse.json({ error: "Proposta desconhecida." }, { status: 404 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    if ("kind" in body) {
      if (!isProposalKind(body.kind)) {
        return NextResponse.json({ error: "Tipo de proposta desconhecido." }, { status: 400 });
      }
      await setProposalKind(slug, body.kind);
    }
    if ("decision" in body) {
      const d = body.decision;
      if (d === null) {
        await setProposalDecision(slug, null);
      } else if (d === "aceite" || d === "recusada") {
        await setProposalDecision(slug, {
          status: d,
          at: Date.now(),
          by: g.actor.username,
          byName: g.actor.name,
        });
      } else {
        return NextResponse.json({ error: "Decisão desconhecida." }, { status: 400 });
      }
    }
    if ("valueEur" in body) {
      const v = sanitizeValueEur(body.valueEur);
      if (v === undefined) {
        return NextResponse.json({ error: "Valor inválido — um número em euros, sem IVA." }, { status: 400 });
      }
      await setProposalValue(slug, v);
    }
    bump(slug, record.clientSlug);
    const next = await getProposalRecord(slug);
    return NextResponse.json({ ok: true, proposal: next });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const g = await guardCommercialWrite();
  if (!g.ok) return g.res;
  const { slug } = await ctx.params;
  const record = await getProposalRecord(slug);
  if (!record) {
    return NextResponse.json({ error: "Proposta desconhecida." }, { status: 404 });
  }
  if (record.source !== "upload") {
    return NextResponse.json(
      { error: "Esta proposta vive em código — apaga-se no repositório, não aqui." },
      { status: 400 },
    );
  }
  try {
    await removeUploadedProposal(slug);
    bump(slug, record.clientSlug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
