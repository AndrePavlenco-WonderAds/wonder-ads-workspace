// Sugestões à direção sobre as listas de Protocolos (v78.51) — Obrigatórios,
// Recomendados e Proibidos. Quem lê a página escreve no fim dela; a direção
// recebe-a no sino (notifications/server.ts) e vê-as na própria página.
//
// Uma lista KV só (`docs:protocol-suggestions`), a mais recente à frente:
// lpush + ltrim, para duas sugestões ao mesmo tempo não se pisarem.

import "server-only";
import { kv } from "@vercel/kv";
import { MAX_SUGGESTION_CHARS, PROTOCOL_LISTS, type ProtocolList } from "./protocolos";

const KEY = "docs:protocol-suggestions";
const MAX_KEPT = 300;

export type ProtocolSuggestion = {
  id: string;
  list: ProtocolList;
  username: string;
  /** O nome como estava no dia. */
  name: string;
  text: string;
  at: number;
};

const configured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

function parse(raw: unknown): ProtocolSuggestion | null {
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
  if (typeof o.id !== "string" || typeof o.text !== "string" || typeof o.at !== "number") return null;
  if (!(PROTOCOL_LISTS as readonly unknown[]).includes(o.list)) return null;
  return {
    id: o.id,
    list: o.list as ProtocolList,
    username: typeof o.username === "string" ? o.username : "",
    name: typeof o.name === "string" ? o.name : "",
    text: o.text.slice(0, MAX_SUGGESTION_CHARS),
    at: o.at,
  };
}

/** Todas, a mais recente à frente. */
export async function listProtocolSuggestions(): Promise<ProtocolSuggestion[]> {
  if (!configured) return [];
  const rows = await kv.lrange<unknown>(KEY, 0, MAX_KEPT - 1);
  return rows.map(parse).filter((s): s is ProtocolSuggestion => s !== null);
}

export async function addProtocolSuggestion(
  s: Omit<ProtocolSuggestion, "id" | "at">,
): Promise<ProtocolSuggestion> {
  if (!configured) throw new Error("KV não configurado.");
  const full: ProtocolSuggestion = {
    ...s,
    id: `ps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
  };
  await kv.lpush(KEY, JSON.stringify(full));
  await kv.ltrim(KEY, 0, MAX_KEPT - 1);
  return full;
}
