// O registo das aulas novas acrescentadas NO CMS da Formação (v78.93). Ver
// updates.ts para o desenho todo.
//
// Uma lista KV (`training-updates`), a mais recente à frente (lpush +
// ltrim). Uma aula só é anunciada uma vez: se já aparece numa entrada (de
// código ou da app), não volta a entrar — despublicar e voltar a publicar
// não manda outro aviso a ninguém.

import "server-only";
import { kv } from "@vercel/kv";
import {
  codeTrainingUpdates,
  type TrainingUpdate,
  type TrainingUpdateLesson,
} from "@/lib/training/updates";

const KEY = "training-updates";
const MAX_KEPT = 100;

const configured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function parseLesson(raw: unknown): TrainingUpdateLesson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return null;
  return {
    id: o.id,
    title: o.title,
    ref: typeof o.ref === "string" ? o.ref : "",
    presenter: typeof o.presenter === "string" ? o.presenter : null,
  };
}

function parse(raw: unknown): TrainingUpdate | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.track !== "string" || typeof o.at !== "number") return null;
  const lessons = (Array.isArray(o.lessons) ? o.lessons : [])
    .map(parseLesson)
    .filter((l): l is TrainingUpdateLesson => l !== null);
  if (lessons.length === 0) return null;
  return {
    id: o.id,
    track: o.track,
    lessons,
    extra: strings(o.extra),
    reachIds: strings(o.reachIds),
    at: o.at,
    source: "app",
  };
}

async function listStored(): Promise<TrainingUpdate[]> {
  if (!configured) return [];
  const rows = await kv.lrange<unknown>(KEY, 0, MAX_KEPT - 1);
  return rows.map(parse).filter((u): u is TrainingUpdate => u !== null);
}

/** Todas as novidades (código + app), a mais recente primeiro. */
export async function listTrainingUpdates(): Promise<TrainingUpdate[]> {
  const stored = await listStored();
  return [...codeTrainingUpdates(), ...stored].sort((a, b) => b.at - a.at);
}

/** Regista o que uma gravação do CMS tornou disponível. Aulas já anunciadas
 *  saem; uma entrada que fique sem aulas não se grava. */
export async function recordTrainingUpdates(updates: TrainingUpdate[]): Promise<void> {
  if (!configured || updates.length === 0) return;
  const announced = new Set(
    (await listTrainingUpdates()).flatMap((u) => u.lessons.map((l) => l.id)),
  );
  for (const u of updates) {
    const lessons = u.lessons.filter((l) => !announced.has(l.id));
    if (lessons.length === 0) continue;
    lessons.forEach((l) => announced.add(l.id));
    await kv.lpush(KEY, JSON.stringify({ ...u, lessons }));
  }
  await kv.ltrim(KEY, 0, MAX_KEPT - 1);
}
