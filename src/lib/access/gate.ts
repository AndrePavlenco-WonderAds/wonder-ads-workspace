// O portão dos acessos (v78.72) — Edge-safe: o middleware e o
// getCurrentSession() leem-no em cada pedido, por isso vive em memória e só
// vai ao KV de 30 em 30 segundos por instância (um HGETALL pequeno).
//
// Fala com o Upstash por REST com `fetch`, sem o @vercel/kv: o cliente puxa
// código Node que o Edge do middleware não suporta. Usa o token SÓ DE
// LEITURA quando existe, e desiste ao fim de 1,5 s.
//
// FALHA ABERTA. Se o KV não responder, fica o último portão conhecido (ou
// nenhum): mais vale um cancelado entrar durante uma falha do KV do que a
// equipa inteira ser posta na rua (lição do limite do Upstash, 12/10).

import {
  ACCESS_GATE_KEY,
  ACCESS_GATE_TTL_MS,
  hydrateGateEntry,
  type AccessGate,
} from "./shared";

const KV_TIMEOUT_MS = 1500;

function kvEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/** Um comando de leitura ao Upstash (POST com o comando em JSON). */
async function kvRead(command: string[]): Promise<unknown> {
  const env = kvEnv();
  if (!env) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  try {
    const res = await fetch(env.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`KV ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(json.error);
    return json.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

let cached: { at: number; gate: AccessGate } | null = null;
let inflight: Promise<AccessGate> | null = null;

/** HGETALL chega como [campo, valor, campo, valor, …] (ou objeto). */
function parseGate(raw: unknown): AccessGate {
  const out: AccessGate = {};
  const add = (u: unknown, v: unknown) => {
    if (typeof u !== "string") return;
    const entry = hydrateGateEntry(v);
    if (entry) out[u] = entry;
  };
  if (Array.isArray(raw)) {
    for (let i = 0; i + 1 < raw.length; i += 2) add(raw[i], raw[i + 1]);
  } else if (raw && typeof raw === "object") {
    for (const [u, v] of Object.entries(raw)) add(u, v);
  }
  return out;
}

/** O portão completo — em cache por instância durante 30 s. */
export async function readAccessGate(): Promise<AccessGate> {
  if (!kvEnv()) return {};
  const now = Date.now();
  if (cached && now - cached.at < ACCESS_GATE_TTL_MS) return cached.gate;
  if (!inflight) {
    inflight = (async () => {
      try {
        const gate = parseGate(await kvRead(["HGETALL", ACCESS_GATE_KEY]));
        cached = { at: Date.now(), gate };
        return gate;
      } catch {
        // Falha aberta: o último portão bom, e volta a tentar daqui a 30 s.
        const gate = cached?.gate ?? {};
        cached = { at: Date.now(), gate };
        return gate;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/** Depois de uma escrita nesta instância, a cache local não espera 30 s. */
export function forgetAccessGateCache(): void {
  cached = null;
}
