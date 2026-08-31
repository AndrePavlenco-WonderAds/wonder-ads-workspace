// Submeter um pedido de ausência.
//   POST { periodKind, startDate, endDate, reason, details, contact,
//          handover, attachment|null, signatureName }
//
// A identidade (nome, cargo, departamento) vem SEMPRE da sessão, nunca do
// body — a folha é um registo de RH e ninguém submete em nome de outra
// pessoa. O «Ver como» dos superadmins também não: o middleware já bloqueia
// qualquer escrita com lente ativa.
//
// A validação é a MESMA função que a folha usa no browser
// (validateAbsenceDraft) — o servidor é a fonte de verdade, o browser é só
// o espelho educado dela.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  absenceDuration,
  reasonById,
  validateAbsenceDraft,
  type AbsenceAttachment,
  type AbsencePeriodKind,
  type AbsenceReasonId,
} from "@/lib/absences-shared";
import { absencesConfigured, createAbsence } from "@/lib/absences-store";
import { announceAbsenceRequest } from "@/lib/absences-slack";

export const runtime = "nodejs";

const PERIOD_KINDS = new Set([
  "hours-1",
  "hours-2",
  "hours-3",
  "morning",
  "afternoon",
  "full-day",
  "multi-day",
]);

function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** O anexo tem de ser um blob NOSSO — um URL arbitrário gravado num registo
 *  de RH e servido ao C-Level como "comprovativo" é phishing servido em
 *  bandeja. */
function cleanAttachment(v: unknown): AbsenceAttachment | null {
  if (!v || typeof v !== "object") return null;
  const at = v as Record<string, unknown>;
  if (typeof at.url !== "string") return null;
  let host = "";
  try {
    const parsed = new URL(at.url);
    if (parsed.protocol !== "https:") return null;
    host = parsed.hostname;
  } catch {
    return null;
  }
  if (!host.endsWith(".public.blob.vercel-storage.com")) return null;
  return {
    url: at.url,
    name: cleanText(at.name, 200) || "comprovativo",
    size:
      typeof at.size === "number" && Number.isFinite(at.size) ? at.size : 0,
    contentType: cleanText(at.contentType, 120),
  };
}

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!absencesConfigured) {
    return NextResponse.json(
      { error: "Armazenamento não configurado neste ambiente." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const periodKind = PERIOD_KINDS.has(b.periodKind as string)
    ? (b.periodKind as AbsencePeriodKind)
    : null;
  if (!periodKind) {
    return NextResponse.json({ error: "Tipo de período inválido." }, { status: 400 });
  }
  const reason = reasonById(b.reason as string);
  if (!reason) {
    return NextResponse.json({ error: "Motivo inválido." }, { status: 400 });
  }

  const startDate = cleanText(b.startDate, 10);
  const single = periodKind !== "multi-day";
  const endDate = single ? startDate : cleanText(b.endDate, 10);
  const attachment = cleanAttachment(b.attachment);

  const draft = {
    periodKind,
    startDate,
    endDate,
    reason: reason.id as AbsenceReasonId,
    details: cleanText(b.details, 2000),
    contact: cleanText(b.contact, 200),
    handover: cleanText(b.handover, 1000),
    hasAttachment: Boolean(attachment),
    signatureName: cleanText(b.signatureName, 120),
  };

  const problem = validateAbsenceDraft(draft);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const duration = absenceDuration(periodKind, startDate, endDate);

  let record;
  try {
    record = await createAbsence({
      username: employee.username,
      name: employee.name,
      role: employee.role,
      dept: employee.dept,
      periodKind,
      startDate,
      endDate,
      calendarDays: duration.calendarDays,
      businessDays: duration.businessDays,
      reason: draft.reason,
      reasonLabel: reason.label,
      details: draft.details,
      contact: draft.contact,
      handover: draft.handover,
      attachment,
      signatureName: draft.signatureName,
    });
  } catch (err) {
    console.error("Ausências: criação falhou:", err);
    return NextResponse.json(
      { error: "Não foi possível gravar o pedido — tenta outra vez." },
      { status: 500 },
    );
  }

  // Slack é notificação, não é parte do registo: nunca pode falhar o pedido.
  await announceAbsenceRequest(record);

  return NextResponse.json({ ok: true, record });
}
