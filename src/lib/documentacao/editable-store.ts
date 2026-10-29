// As páginas da Documentação que a direção edita na própria página (v78.46):
// a Jornada de Cliente e as duas listas de Protocolos. Uma chave KV por
// documento; sem nada guardado, vale a versão de partida do código.

import "server-only";
import { kv } from "@vercel/kv";
import { DEFAULT_JOURNEY, normalizeJourney, type Journey } from "./jornada";
import { DEFAULT_PROTOCOLS, normalizeProtocols, type ProtocolDoc, type ProtocolList } from "./protocolos";

const JOURNEY_KEY = "docs:jornada-cliente";
const protocolsKey = (list: ProtocolList) => `docs:protocolos:${list}`;

const configured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const stamp = (raw: Record<string, unknown>) => ({
  updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
  updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
});

export async function getJourney(): Promise<Journey> {
  if (!configured) return DEFAULT_JOURNEY;
  try {
    const raw = await kv.get<Record<string, unknown>>(JOURNEY_KEY);
    const clean = raw ? normalizeJourney(raw) : null;
    return clean ? { ...clean, ...stamp(raw!) } : DEFAULT_JOURNEY;
  } catch (err) {
    console.error("docs journey read failed:", err);
    return DEFAULT_JOURNEY;
  }
}

export async function saveJourney(data: Omit<Journey, "updatedAt" | "updatedBy">, by: string): Promise<Journey> {
  const next: Journey = { ...data, updatedAt: Date.now(), updatedBy: by };
  await kv.set(JOURNEY_KEY, next);
  return next;
}

export async function getProtocols(list: ProtocolList): Promise<ProtocolDoc> {
  if (!configured) return DEFAULT_PROTOCOLS[list];
  try {
    const raw = await kv.get<Record<string, unknown>>(protocolsKey(list));
    const clean = raw ? normalizeProtocols(raw) : null;
    return clean ? { ...clean, ...stamp(raw!) } : DEFAULT_PROTOCOLS[list];
  } catch (err) {
    console.error("docs protocols read failed:", err);
    return DEFAULT_PROTOCOLS[list];
  }
}

export async function saveProtocols(list: ProtocolList, data: Pick<ProtocolDoc, "items">, by: string): Promise<ProtocolDoc> {
  const next: ProtocolDoc = { ...data, updatedAt: Date.now(), updatedBy: by };
  await kv.set(protocolsKey(list), next);
  return next;
}
