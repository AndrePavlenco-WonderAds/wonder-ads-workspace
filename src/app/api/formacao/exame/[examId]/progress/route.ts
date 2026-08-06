// Gravação periódica da folha durante um EXAME DE FASE.
//   POST /api/formacao/exame/<examId>/progress
//   { answers: [...], focusLossCount?: number }
//
// É isto que dá sentido à regra "acabar o tempo fica como está o progresso".
// Sem um snapshot no servidor, quem fechasse o portátil aos 55 minutos levava
// zero — o que não é o resultado do exame, é o resultado de um bug. Com ele, a
// folha recolhida ao apito é a última que a pessoa gravou dentro do tempo.
//
// Depois do prazo isto não escreve nada e responde `expired`: a folha já foi
// recolhida, e uma resposta escrita aos 61 minutos não entra.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { findExam } from "@/lib/training/exams";
import {
  effectiveStatus,
  msRemaining,
  saveExamProgress,
} from "@/lib/training/exam-sessions-store";
import type { SubmittedAnswer } from "@/lib/training/grading";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> },
) {
  const { examId } = await params;
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!findExam(examId)) {
    return NextResponse.json({ error: "Exame desconhecido." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { answers: rawAnswers, focusLossCount } = (body ?? {}) as {
    answers?: unknown;
    focusLossCount?: unknown;
  };
  if (!Array.isArray(rawAnswers)) {
    return NextResponse.json({ error: "answers em falta" }, { status: 400 });
  }
  const answers: SubmittedAnswer[] = rawAnswers
    .filter(
      (a): a is Record<string, unknown> => Boolean(a) && typeof a === "object",
    )
    .filter((a) => typeof a.questionId === "string")
    .map((a) => ({
      questionId: a.questionId as string,
      optionIds: Array.isArray(a.optionIds)
        ? a.optionIds.filter((x): x is string => typeof x === "string")
        : [],
      text: typeof a.text === "string" ? a.text : null,
    }));

  const now = Date.now();
  const session = await saveExamProgress(
    employee.username,
    examId,
    answers,
    typeof focusLossCount === "number" && Number.isFinite(focusLossCount)
      ? Math.max(0, Math.floor(focusLossCount))
      : 0,
    now,
  );

  if (!session) {
    return NextResponse.json(
      { error: "Não há nenhum exame a decorrer." },
      { status: 409 },
    );
  }

  const status = effectiveStatus(session, now);
  return NextResponse.json({
    ok: status === "running",
    status,
    expired: status === "expired",
    msLeft: msRemaining(session, now),
    serverNow: now,
  });
}
