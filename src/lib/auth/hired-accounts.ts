// Contas criadas NA APP (v80.13) — quem foi aceite no Recrutamento.
//
// Até aqui todas as contas viviam em credentials.ts e só nasciam com um
// deploy. Um candidato aceite ganha agora uma conta na hora: a linha fica no
// KV (`hr:accounts`, hash username → dados da conta) e a password no cofre
// dos Acessos (`access:cred:<u>`), que já ganhava ao hash do código desde a
// v78.72. A linha NUNCA guarda material de password.
//
// O resto da app procura pessoas com `findEmployeeByUsername`, que é síncrona.
// Por isso esta lista vive em memória por instância (como o portão dos
// acessos): o middleware, `readLiveSession` e o login chamam
// `ensureHiredAccounts()` antes de decidir, e ela vai ao KV no máximo de 30
// em 30 segundos. Edge-safe: só `fetch`, sem o @vercel/kv.
//
// FALHA ABERTA, como o portão: se o KV não responder fica a última lista boa.
// Uma conta nova pode demorar até 30 s a ser reconhecida noutra instância; o
// login força uma leitura fresca quando não encontra a pessoa.

import { setRuntimeCredentials, type EmployeeCredential } from "./credentials";

export const HIRED_ACCOUNTS_KEY = "hr:accounts";
const TTL_MS = 30_000;
const KV_TIMEOUT_MS = 1500;

export type HiredAccount = {
  username: string;
  /** Nome curto da app (é também o nome da coluna no SEO DPT). */
  name: string;
  fullName: string;
  role: string;
  /** «SEO» — o departamento com que entra. */
  dept: string;
  /** Dia 1 (ISO yyyy-mm-dd): âncora dos exames da Formação. */
  startedAt: string | null;
  candidateId: string;
  createdAt: number;
  createdBy: string;
};

export function hydrateHiredAccount(raw: unknown): HiredAccount | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" ? x : "");
  if (!s(o.username) || !s(o.name)) return null;
  return {
    username: s(o.username).toLowerCase(),
    name: s(o.name),
    fullName: s(o.fullName) || s(o.name),
    role: s(o.role) || "Consultor de SEO",
    dept: s(o.dept) || "SEO",
    startedAt: s(o.startedAt) || null,
    candidateId: s(o.candidateId),
    createdAt: typeof o.createdAt === "number" ? o.createdAt : 0,
    createdBy: s(o.createdBy),
  };
}

/** A conta em forma de credencial. Sem salt nem hash: a password está só no
 *  cofre, e um hash vazio nunca confere. */
export function hiredToCredential(a: HiredAccount): EmployeeCredential {
  return {
    username: a.username,
    name: a.name,
    fullName: a.fullName,
    role: a.role,
    dept: a.dept,
    startedAt: a.startedAt ?? undefined,
    salt: "",
    hash: "",
  };
}

function kvEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function fetchAccounts(): Promise<HiredAccount[]> {
  const env = kvEnv();
  if (!env) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  try {
    const res = await fetch(env.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["HGETALL", HIRED_ACCOUNTS_KEY]),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`KV ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(json.error);
    const raw = json.result;
    const out: HiredAccount[] = [];
    if (Array.isArray(raw)) {
      for (let i = 0; i + 1 < raw.length; i += 2) {
        const a = hydrateHiredAccount(raw[i + 1]);
        if (a) out.push(a);
      }
    } else if (raw && typeof raw === "object") {
      for (const v of Object.values(raw)) {
        const a = hydrateHiredAccount(v);
        if (a) out.push(a);
      }
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

let cached: { at: number; list: HiredAccount[] } | null = null;
let inflight: Promise<HiredAccount[]> | null = null;

/** Garante a lista em memória (30 s por instância). `fresh` ignora a cache —
 *  o login usa-o quando não encontra a pessoa. */
export async function ensureHiredAccounts(opts: { fresh?: boolean } = {}): Promise<HiredAccount[]> {
  if (!kvEnv()) return [];
  const now = Date.now();
  if (!opts.fresh && cached && now - cached.at < TTL_MS) return cached.list;
  // Mesmo «fresca», no máximo uma leitura a cada 5 s (um login com um nome
  // inventado não pode virar uma rajada de leituras ao KV).
  if (opts.fresh && cached && now - cached.at < 5_000) return cached.list;
  if (!inflight) {
    inflight = (async () => {
      try {
        const list = await fetchAccounts();
        cached = { at: Date.now(), list };
        setRuntimeCredentials(list.map(hiredToCredential));
        return list;
      } catch {
        const list = cached?.list ?? [];
        cached = { at: Date.now(), list };
        return list;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/** Depois de criar uma conta nesta instância, não esperar 30 s. */
export function rememberHiredAccount(a: HiredAccount): void {
  const list = [...(cached?.list ?? []).filter((x) => x.username !== a.username), a];
  cached = { at: Date.now(), list };
  setRuntimeCredentials(list.map(hiredToCredential));
}
