// O nível de excesso de cada consultor (v78.70) — ver `overload.ts`.
//
// Uma chave por pessoa (`notification-load:<username>`) com o nível, o número
// e desde quando. Escreve-se SÓ quando muda alguma coisa, e depois da
// resposta (`after`): o header nunca espera por uma escrita, e uma pessoa a
// saltar entre páginas sem resolver nada não custa escrita nenhuma.
//
// Sem KV (dev local em modo memória) guarda-se num Map do processo, para a
// folga 10 → abaixo de 5 se poder testar sem tocar na base de produção.

import { after } from "next/server";
import { kv } from "@vercel/kv";
import {
  nextOverloadLevel,
  type OverloadLevel,
  type OverloadState,
} from "./overload";

type Stored = OverloadState & { updatedAt: number };

const configured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

const memory = new Map<string, Stored>();

function loadKey(username: string): string {
  return `notification-load:${username}`;
}

function normalize(raw: unknown): Stored | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const level = r.level;
  if (level !== "ok" && level !== "warn" && level !== "excess") return null;
  const count = typeof r.count === "number" && Number.isFinite(r.count) ? r.count : 0;
  const since = typeof r.since === "number" && Number.isFinite(r.since) ? r.since : null;
  const updatedAt =
    typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt) ? r.updatedAt : 0;
  return { level, count, since, updatedAt };
}

async function readOne(username: string): Promise<Stored | null> {
  if (!configured) return memory.get(username) ?? null;
  try {
    return normalize(await kv.get<unknown>(loadKey(username)));
  } catch (err) {
    console.error("KV notification-load read failed:", err);
    return null;
  }
}

async function writeOne(username: string, value: Stored): Promise<void> {
  if (!configured) {
    memory.set(username, value);
    return;
  }
  await kv.set(loadKey(username), value);
}

/** Calcula o nível desta pessoa a partir do que tem em aberto AGORA e do
 *  nível em que estava, e grava-o se mudou. Chamado pelo sino do header, em
 *  cada página. Nunca lança: um erro aqui não pode impedir uma página de
 *  abrir — no pior caso a pessoa fica sem aviso nessa página. */
export async function resolveOverload(
  username: string,
  count: number,
  nowMs: number = Date.now(),
): Promise<OverloadState> {
  const previous = await readOne(username);
  const level = nextOverloadLevel(count, previous?.level ?? null);
  const since =
    level === "ok"
      ? null
      : previous && previous.level === level && previous.since
        ? previous.since
        : nowMs;
  const state: OverloadState = { level, count, since };

  const changed =
    !previous
      ? level !== "ok"
      : previous.level !== level || previous.count !== count;
  if (changed) {
    const value: Stored = { ...state, updatedAt: nowMs };
    const write = () =>
      writeOne(username, value).catch((err) => {
        console.error("KV notification-load write failed:", err);
      });
    try {
      after(write);
    } catch {
      // Fora de um pedido (scripts) — escreve já.
      await write();
    }
  }
  return state;
}

/** O nível de várias pessoas numa só operação — para o painel de equipa do
 *  Superadmin. Quem nunca passou dos 7 não tem chave e vem como «ok». */
export async function getOverloadMany(
  usernames: string[],
): Promise<Record<string, OverloadState & { updatedAt: number }>> {
  const out: Record<string, Stored> = {};
  if (usernames.length === 0) return out;
  if (!configured) {
    for (const u of usernames) {
      const v = memory.get(u);
      if (v) out[u] = v;
    }
    return out;
  }
  try {
    const rows = await kv.mget<unknown[]>(...usernames.map(loadKey));
    usernames.forEach((u, i) => {
      const v = normalize(rows?.[i]);
      if (v) out[u] = v;
    });
  } catch (err) {
    console.error("KV notification-load mget failed:", err);
  }
  return out;
}

export type { OverloadLevel };
