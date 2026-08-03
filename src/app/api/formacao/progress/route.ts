// Amostras de reprodução do player da Formação.
//   POST { lessonId, watchedSeconds, percent, manual? }
//
// O utilizador vem SEMPRE da sessão — nunca do body. Um consultor não pode
// escrever progresso em nome de outro, mesmo forjando o pedido.
//
// O `lessonId` é validado contra o catálogo em vigor: ids inventados não
// criam entradas fantasma que depois apareceriam no overview do admin.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getTrainingCatalog } from "@/lib/training/content-store";
import { locateLesson } from "@/lib/training/catalog";
import {
  recordLessonProgress,
  trainingProgressStorageConfigured,
} from "@/lib/training/progress-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!trainingProgressStorageConfigured) {
    return NextResponse.json(
      { error: "KV storage not configured on this deployment." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const {
    lessonId,
    watchedSeconds,
    percent,
    manual,
  } = (body ?? {}) as Record<string, unknown>;

  if (typeof lessonId !== "string" || !lessonId.trim()) {
    return NextResponse.json({ error: "lessonId em falta" }, { status: 400 });
  }
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return NextResponse.json({ error: "percent inválido" }, { status: 400 });
  }

  const tracks = await getTrainingCatalog();
  const hit = locateLesson(tracks, lessonId);
  if (!hit) {
    return NextResponse.json({ error: "Aula desconhecida." }, { status: 404 });
  }

  try {
    const entry = await recordLessonProgress(
      employee.username,
      lessonId,
      {
        watchedSeconds:
          typeof watchedSeconds === "number" && Number.isFinite(watchedSeconds)
            ? watchedSeconds
            : 0,
        percent,
        manual: manual === true,
      },
      Date.now(),
    );
    return NextResponse.json({ ok: true, progress: entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
