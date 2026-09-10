// A escolha de cada pessoa: que medalhas mostrar no header (até 3).
//
// Uma chave por username (`medals:display:<username>`), uma lista de ids.
// null = nunca escolheu → o header mostra as três de maior prestígio. Uma
// lista vazia é uma escolha válida («não mostrar nenhuma»).

import { kv } from "@vercel/kv";
import { MAX_DISPLAYED, isMedalId } from "./catalog";

const KEY_PREFIX = "medals:display:";

export const medalsStoreConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getDisplayChoice(username: string): Promise<string[] | null> {
  if (!medalsStoreConfigured) return null;
  try {
    const raw = await kv.get<unknown>(`${KEY_PREFIX}${username}`);
    if (!Array.isArray(raw)) return null;
    return raw.filter(isMedalId).slice(0, MAX_DISPLAYED);
  } catch (err) {
    console.error("medalhas: leitura da escolha falhou:", err);
    return null;
  }
}

export async function setDisplayChoice(username: string, ids: string[]): Promise<void> {
  const clean = Array.from(new Set(ids.filter(isMedalId))).slice(0, MAX_DISPLAYED);
  await kv.set(`${KEY_PREFIX}${username}`, clean);
}
