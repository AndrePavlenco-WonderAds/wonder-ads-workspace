// Credenciais das ferramentas da agência — o que a página /tools mostra
// por baixo de cada logótipo.
//
// Modelo de armazenamento (o mesmo do cofre por cliente, client-accesses-store):
//   - Só KV (privado a quem tem sessão no workspace; a Vercel/Upstash
//     cifra em repouso).
//   - Texto simples. A UI mascara a password com revelar/copiar, e não
//     existe caminho de leitura público — a página vive atrás do
//     middleware e a escrita atrás de isCurrentUserAdmin().
//
// UM ÚNICO REGISTO, NÃO UM POR FERRAMENTA. São ~11 ferramentas lidas
// sempre todas de uma vez (a página mostra o baralho inteiro): um GET de
// KV por render em vez de onze.

import { kv } from "@vercel/kv";

const KEY = "tools:accesses";

export const toolsAccessStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type ToolAccess = {
  username: string | null;
  password: string | null;
  /** Quem gravou pela última vez, e quando. Aparece no modal de edição —
   *  uma password partilhada sem dono não se sabe a quem perguntar. */
  updatedAt: number | null;
  updatedBy: string | null;
};

/** Mapa id-da-ferramenta → credencial. Ferramentas ainda sem acesso
 *  simplesmente não têm chave. */
export type ToolAccessMap = Record<string, ToolAccess>;

export const EMPTY_TOOL_ACCESS: ToolAccess = {
  username: null,
  password: null,
  updatedAt: null,
  updatedBy: null,
};

/** O KV devolve o objeto cru que lá foi gravado: um registo escrito antes
 *  de um campo existir volta sem ele. Tudo o que sai daqui passa por
 *  aqui, para a página nunca ler `undefined`. */
function hydrateAccess(raw: unknown): ToolAccess {
  if (!raw || typeof raw !== "object") return { ...EMPTY_TOOL_ACCESS };
  const o = raw as Record<string, unknown>;
  return {
    username: typeof o.username === "string" ? o.username : null,
    password: typeof o.password === "string" ? o.password : null,
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : null,
    updatedBy: typeof o.updatedBy === "string" ? o.updatedBy : null,
  };
}

export async function listToolAccesses(): Promise<ToolAccessMap> {
  if (!toolsAccessStorageConfigured) return {};
  try {
    const raw = await kv.get<Record<string, unknown>>(KEY);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: ToolAccessMap = {};
    for (const [id, value] of Object.entries(raw)) {
      out[id] = hydrateAccess(value);
    }
    return out;
  } catch (err) {
    console.error("tools accesses read failed:", err);
    return {};
  }
}

/** Grava a credencial de UMA ferramenta, preservando as restantes.
 *  Devolve a entrada gravada (já hidratada) ou null sem KV configurado. */
export async function saveToolAccess(
  id: string,
  patch: { username: string | null; password: string | null },
  updatedBy: string,
): Promise<ToolAccess | null> {
  if (!toolsAccessStorageConfigured) return null;
  const current = await listToolAccesses();
  const entry: ToolAccess = {
    username: patch.username,
    password: patch.password,
    updatedAt: Date.now(),
    updatedBy,
  };
  await kv.set(KEY, { ...current, [id]: entry });
  return entry;
}

/** Limpa a credencial de uma ferramenta (o cartão volta a «Por definir»). */
export async function clearToolAccess(id: string): Promise<void> {
  if (!toolsAccessStorageConfigured) return;
  const current = await listToolAccesses();
  if (!(id in current)) return;
  delete current[id];
  await kv.set(KEY, current);
}

/** Higieniza o corpo de um PUT. Só os dois campos, com tetos de tamanho
 *  para o blob de KV não crescer sem limite. String vazia → null, para
 *  «apagar o campo» e «nunca preenchido» serem o mesmo estado. */
export function sanitiseToolAccessBody(raw: unknown): {
  username: string | null;
  password: string | null;
} {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const trim = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim().slice(0, max);
    return t.length > 0 ? t : null;
  };
  return {
    username: trim(o.username, 200),
    password: trim(o.password, 400),
  };
}
