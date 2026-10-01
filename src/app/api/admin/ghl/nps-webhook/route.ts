// Ligar o aviso de NPS ao workflow do GHL (WhatsApp privado).
//
// GET                     → { configured } — está GHL_NPS_WEBHOOK_URL na Vercel?
// GET ?send=1             → UM pedido de exemplo, só para o André (nunca para os
//                           consultores). Serve de «pedido de exemplo» para o
//                           gatilho Inbound Webhook do GHL mapear os campos.
// GET ?send=1&slug=<slug> → TESTE COMPLETO, como um NPS real submetido agora:
//                           corre a mesma função que o formulário do cliente
//                           (consultor ATUAL da conta + André), com as notas da
//                           última resposta real desse cliente (ou de exemplo,
//                           se nunca respondeu). Não grava nada no NPS do
//                           cliente — só dispara os WhatsApps.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { ghlNpsWebhookConfigured, postToGhlNpsWebhook } from "@/lib/ghl";
import { getClientBySlug } from "@/lib/notion";
import { getNpsRecord } from "@/lib/nps-store";
import type { NpsScores } from "@/lib/nps-questions";
import { getConsultantForSlug } from "@/lib/consultant-assignments";
import {
  buildNpsGhlPayloads,
  notifyNpsOnWhatsApp,
  NPS_ALWAYS_NOTIFY,
} from "@/lib/nps-whatsapp";

export const runtime = "nodejs";

const SAMPLE_SCORES: NpsScores = {
  overall: 6.25,
  nps: 4,
  category: "detractor",
  satisfaction: 6,
  consultant: 7,
  progress: 8,
};

export async function GET(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const configured = ghlNpsWebhookConfigured();
  if (params.get("send") !== "1") {
    return NextResponse.json({
      configured,
      hint: configured
        ? "Webhook configurado. ?send=1 → exemplo só para o André; ?send=1&slug=<cliente> → teste completo (consultor + André)."
        : "Falta GHL_NPS_WEBHOOK_URL na Vercel (ou o deploy ainda não o apanhou).",
    });
  }

  if (!configured) {
    return NextResponse.json(
      { configured, sent: false, error: "GHL_NPS_WEBHOOK_URL não definido." },
      { status: 503 },
    );
  }

  const origin = new URL(req.url).origin;
  const slug = params.get("slug")?.trim();

  if (slug) {
    const client = await getClientBySlug(slug).catch(() => null);
    if (!client) {
      return NextResponse.json(
        { configured, sent: false, error: `Cliente SEO «${slug}» não encontrado.` },
        { status: 404 },
      );
    }
    // Igual ao formulário: o consultor é o da conta HOJE (migrações incluídas).
    const consultant = await getConsultantForSlug(slug);
    const latest = (await getNpsRecord(slug)).submissions[0] ?? null;
    const results = await notifyNpsOnWhatsApp({
      slug,
      scores: latest?.scores ?? SAMPLE_SCORES,
      consultant: consultant === "Unassigned" ? null : consultant,
      identification: latest?.identification ?? null,
      submittedAt: Date.now(),
      origin,
      isTest: true,
    });
    return NextResponse.json({
      configured,
      client: client.title,
      consultant,
      scoresFrom: latest ? `resposta real de ${new Date(latest.submittedAt).toISOString()}` : "exemplo",
      sent: results.length > 0 && results.every((r) => r.ok),
      results,
    });
  }

  const [sample] = buildNpsGhlPayloads({
    slug: "cliente-de-teste",
    clientTitle: "Cliente de teste",
    scores: SAMPLE_SCORES,
    // Sem consultor → o único destinatário é o André.
    consultant: null,
    identification: "Pedido de teste do Workspace",
    npsUrl: `${origin}/seo`,
    submittedAt: Date.now(),
    isTest: true,
  });
  const sent = await postToGhlNpsWebhook(sample);
  return NextResponse.json({
    configured,
    sent,
    recipient: NPS_ALWAYS_NOTIFY.email,
    payload: sample,
  });
}
