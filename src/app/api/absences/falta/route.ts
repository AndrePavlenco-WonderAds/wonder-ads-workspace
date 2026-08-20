// Lançar uma falta a um colaborador (folha RH-02).
//   POST { username, periodKind, startDate, endDate, reason, justified,
//          details, attachment|null, signatureName }
//
// SÓ SUPERADMIN. O gate da página vive no layout de /admin, mas esta rota
// verifica por conta própria — uma API que confia no ecrã que a chamou não é
// uma API, é um botão. O middleware já bloqueou qualquer escrita com lente
// «Ver como» ativa, por isso um superadmin na pele de outra pessoa não
// consegue lançar faltas em nome dela.
//
// A identidade do VISADO vem do roster (credentials.ts) a partir do
// username, nunca do body: quem chama escolhe A QUEM, não O QUÊ sobre ele.
// A classificação justificada/injustificada também é re-derivada do catálogo
// — o body só decide nos motivos que a deixam em aberto ("Outro motivo").

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getEmployeeDisplay } from "@/lib/auth/credentials";
import {
  absenceDuration,
  faltaReasonById,
  validateFaltaDraft,
  type AbsenceAttachment,
  type AbsencePeriodKind,
  type FaltaReasonId,
} from "@/lib/absences-shared";
import { absencesConfigured, createFalta } from "@/lib/absences-store";
import { announceFaltaRegistered } from "@/lib/absences-slack";

export const runtime = "nodejs";

const PERIOD_KINDS = new Set(["morning", "afternoon", "full-day", "multi-day"]);

function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** O anexo tem de ser um blob NOSSO — mesma regra da folha de pedido. */
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
    name: cleanText(at.name, 200) || "documento",
    size: typeof at.size === "number" && Number.isFinite(at.size) ? at.size : 0,
    contentType: cleanText(at.contentType, 120),
  };
}

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!employee.isAdmin) {
    return NextResponse.json(
      { error: "Só o C-Level pode registar faltas." },
      { status: 403 },
    );
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

  const username = cleanText(b.username, 60).toLowerCase();
  const target = username ? getEmployeeDisplay(username) : null;
  if (!target) {
    return NextResponse.json(
      { error: "Colaborador desconhecido." },
      { status: 400 },
    );
  }

  const periodKind = PERIOD_KINDS.has(b.periodKind as string)
    ? (b.periodKind as AbsencePeriodKind)
    : null;
  if (!periodKind) {
    return NextResponse.json({ error: "Tipo de período inválido." }, { status: 400 });
  }
  const reason = faltaReasonById(b.reason as string);
  if (!reason) {
    return NextResponse.json({ error: "Motivo inválido." }, { status: 400 });
  }

  // O catálogo manda; o body só é ouvido quando o motivo deixa a
  // classificação em aberto.
  const justified =
    reason.justified !== null
      ? reason.justified
      : typeof b.justified === "boolean"
        ? b.justified
        : null;

  const startDate = cleanText(b.startDate, 10);
  const single = periodKind !== "multi-day";
  const endDate = single ? startDate : cleanText(b.endDate, 10);
  const attachment = cleanAttachment(b.attachment);

  const draft = {
    username,
    periodKind,
    startDate,
    endDate,
    reason: reason.id as FaltaReasonId,
    justified,
    details: cleanText(b.details, 2000),
    signatureName: cleanText(b.signatureName, 120),
  };

  const problem = validateFaltaDraft(draft);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const duration = absenceDuration(periodKind, startDate, endDate);

  let record;
  try {
    record = await createFalta({
      username,
      justified,
      name: target.name,
      role: target.role,
      dept: target.dept,
      periodKind,
      startDate,
      endDate,
      calendarDays: duration.calendarDays,
      businessDays: duration.businessDays,
      reason: reason.id,
      reasonLabel: reason.label,
      details: draft.details,
      contact: "",
      handover: "",
      attachment,
      signatureName: draft.signatureName,
      registeredBy: employee.username,
      registeredByName: employee.name,
    });
  } catch (err) {
    console.error("Faltas: criação falhou:", err);
    return NextResponse.json(
      { error: "Não foi possível registar a falta — tenta outra vez." },
      { status: 500 },
    );
  }

  // Slack é notificação, não é parte do registo: nunca pode falhar o pedido.
  await announceFaltaRegistered(record);

  return NextResponse.json({ ok: true, record });
}
