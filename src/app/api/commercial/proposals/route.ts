// POST /api/commercial/proposals — grava uma proposta carregada em PDF,
// com os metadados que o consultor reviu no modal. O ficheiro já está no
// Blob (upload direto do browser via /api/files/upload); aqui só entra o
// registo. A partir daqui a proposta aparece no Comercial e em
// /proposta/<slug>, como as que vivem em código.

import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { isProposalKind } from "@/lib/proposals";
import { addUploadedProposal } from "@/lib/proposals/store";
import { sanitizeValueEur } from "@/lib/proposals/value";
import { guardCommercialWrite } from "@/lib/proposals/api-guard";
import { syncMedalsAndNotify } from "@/lib/medals/notify";
import { EMPLOYEE_CREDENTIALS } from "@/lib/auth/credentials";
import { toISODate } from "@/lib/dates";

export const runtime = "nodejs";

function s(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  const g = await guardCommercialWrite();
  if (!g.ok) return g.res;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const file = body.file && typeof body.file === "object" ? (body.file as Record<string, unknown>) : null;
  const fileUrl = file ? s(file.url, 2000) : "";
  if (!/^https:\/\//.test(fileUrl)) {
    return NextResponse.json({ error: "Falta o ficheiro da proposta." }, { status: 400 });
  }
  const clientName = s(body.clientName, 120);
  const title = s(body.title, 160);
  if (!clientName || !title) {
    return NextResponse.json({ error: "Cliente e título são obrigatórios." }, { status: 400 });
  }
  const kind = isProposalKind(body.kind) ? body.kind : "renovacao";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(s(body.date)) ? s(body.date) : toISODate();
  const consultantUsername = s(body.consultantUsername, 60) || null;
  const signer = consultantUsername
    ? EMPLOYEE_CREDENTIALS.find((c) => c.username === consultantUsername) ?? null
    : null;
  const consultant = signer?.name ?? s(body.consultant, 80) ?? "";

  try {
    const record = await addUploadedProposal({
      clientSlug: s(body.clientSlug, 80) || null,
      clientName,
      title,
      kind,
      status: "enviada",
      date,
      period: s(body.period, 160),
      consultant,
      consultantUsername: signer?.username ?? null,
      summary: s(body.summary, 300),
      investment: s(body.investment, 160),
      // Valor total sem IVA — o que o pódio pesa. Inválido → sem valor (a
      // lista estima a partir do texto e marca como «estimado»).
      valueEur: sanitizeValueEur(body.valueEur) ?? null,
      file: {
        url: fileUrl,
        name: s(file?.name, 200) || "proposta.pdf",
        size: typeof file?.size === "number" ? file.size : 0,
        type: s(file?.type, 100) || "application/pdf",
        pages: typeof file?.pages === "number" ? file.pages : null,
      },
      uploadedAt: Date.now(),
      uploadedBy: g.actor.username,
      uploadedByName: g.actor.name,
    });
    revalidatePath("/commercial");
    if (record.clientSlug) revalidatePath(`/seo/${record.clientSlug}`);
    // Medalhas novas → #team-wins, depois da resposta.
    after(() => syncMedalsAndNotify(`post:${record.slug}`));
    return NextResponse.json({ ok: true, slug: record.slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
