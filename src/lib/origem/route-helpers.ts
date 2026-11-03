// Origem de Pacientes — o portão comum das APIs e utilitários.

import "server-only";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getOrigemConfig, type OrigemClient } from "./config";
import { getOrigemViewer, type OrigemViewer } from "./access";
import { origemStoreReady } from "./store";

export type OrigemGateOk = { cfg: OrigemClient; viewer: OrigemViewer };

export async function origemGate(slug: string, opts: { write?: boolean } = {}): Promise<OrigemGateOk | NextResponse> {
  const cfg = getOrigemConfig(slug);
  if (!cfg) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (!origemStoreReady) return NextResponse.json({ error: "Armazenamento indisponível." }, { status: 503 });
  const viewer = await getOrigemViewer(slug);
  if (!viewer) return NextResponse.json({ error: "Sessão expirada. Volte a introduzir o PIN." }, { status: 401 });
  if (opts.write && !viewer.canWrite) {
    return NextResponse.json({ error: "Este perfil só pode consultar." }, { status: 403 });
  }
  return { cfg, viewer };
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

const kvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

/** Conta pedidos numa janela; true = passou do limite. Sem KV, nunca trava. */
export async function overLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!kvConfigured) return false;
  try {
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, windowSeconds);
    return n > max;
  } catch {
    return false;
  }
}

export const DEVICE_RE = /^d[a-z0-9]{6,20}$/;
