// Ordem pessoal da carteira na board do SEO DPT (v78.4).
//
// Cada consultor pode reordenar os cartões da SUA lane. A ordem é dele e só
// dele: guarda-se pelo username, só se aplica à lane dele e só quando é ele a
// ver — toda a gente continua a ver a ordem por tier de sempre.
//
// Uma chave KV por consultor com a lista de slugs. Clientes que entrem
// depois (sem lugar na lista) vão para o fim, pela ordem por tier; slugs que
// saiam da carteira ficam na lista sem efeito até à próxima gravação.

import "server-only";
import { kv } from "@vercel/kv";

const KEY_PREFIX = "seo-board-order:";
const MAX = 200;

const configured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getBoardOrder(username: string): Promise<string[]> {
  if (!configured || !username) return [];
  try {
    const raw = await kv.get<unknown>(KEY_PREFIX + username);
    if (!Array.isArray(raw)) return [];
    return raw.filter((s): s is string => typeof s === "string");
  } catch (err) {
    console.error("seo-board-order read failed:", err);
    return [];
  }
}

export async function setBoardOrder(
  username: string,
  slugs: string[],
): Promise<void> {
  if (!configured) throw new Error("KV storage not configured on this deployment.");
  await kv.set(KEY_PREFIX + username, slugs.slice(0, MAX));
}

export async function clearBoardOrder(username: string): Promise<void> {
  if (!configured) throw new Error("KV storage not configured on this deployment.");
  await kv.del(KEY_PREFIX + username);
}

/** Aplica uma ordem guardada: os slugs da lista primeiro, pela ordem dela;
 *  o resto a seguir, na ordem em que já vinham (por tier). */
export function applyBoardOrder<T extends { slug: string }>(
  clients: T[],
  order: string[],
): T[] {
  if (order.length === 0) return clients;
  const pos = new Map(order.map((s, i) => [s, i]));
  return clients
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const pa = pos.get(a.c.slug) ?? order.length + a.i;
      const pb = pos.get(b.c.slug) ?? order.length + b.i;
      return pa - pb;
    })
    .map(({ c }) => c);
}
