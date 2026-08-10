// POST /api/formacao/feedback — o consultor responde sobre o formador, o
// vídeo e o processo de formação até àquele momento.
//
// Escreve em KV e, a partir daí, o feedback aparece SOZINHO no sino de quem é
// SuperAdmin (ver `trainingFeedbackNotifications` em notifications/server.ts).
// Não há aqui nenhum passo de "enviar notificação": a notificação é derivada
// do registo, como todas as outras do sino. Um envio explícito podia falhar
// sem ninguém dar por isso e deixar o feedback num sítio que ninguém abre.
//
// Não se aceita `username` do corpo — a identidade vem da sessão. Senão,
// qualquer sessão válida podia assinar feedback em nome de outra pessoa.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { saveTrainingFeedback } from "@/lib/training/feedback-store";
import {
  getTrainingProgress,
  WATCHED_THRESHOLD,
} from "@/lib/training/progress-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const ratings = (b.ratings ?? {}) as Record<string, unknown>;

  const ok = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 5;
  if (!ok(ratings.instructor) || !ok(ratings.video) || !ok(ratings.process)) {
    return NextResponse.json(
      { error: "Faltam notas — o formador, o vídeo e o processo, de 1 a 5." },
      { status: 400 },
    );
  }

  // Quantas aulas tinha visto ao responder. Serve para dois fins: dá peso à
  // resposta ("isto vem de quem já viu 22 aulas") e é o marco a partir do
  // qual se conta o próximo lembrete.
  let lessonsWatched = 0;
  try {
    const progress = await getTrainingProgress(employee.username);
    lessonsWatched = Object.values(progress.lessons).filter(
      (l) => l.percent >= WATCHED_THRESHOLD || l.completedAt !== null,
    ).length;
  } catch (err) {
    console.error("training feedback: leitura de progresso falhou:", err);
  }

  try {
    const saved = await saveTrainingFeedback({
      username: employee.username,
      name: employee.name,
      role: employee.role,
      dept: employee.dept,
      trackSlug: typeof b.trackSlug === "string" ? b.trackSlug : "",
      lessonId: typeof b.lessonId === "string" ? b.lessonId : "",
      lessonTitle: typeof b.lessonTitle === "string" ? b.lessonTitle : "",
      presenter: typeof b.presenter === "string" ? b.presenter : null,
      ratings: {
        instructor: ratings.instructor as number,
        video: ratings.video as number,
        process: ratings.process as number,
      },
      whatWorked: typeof b.whatWorked === "string" ? b.whatWorked : "",
      whatMissing: typeof b.whatMissing === "string" ? b.whatMissing : "",
      suggestions: typeof b.suggestions === "string" ? b.suggestions : "",
      lessonsWatchedAtTime: lessonsWatched,
    });
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
