// Persistência da Ficha do prospect (v80.0).
//
//   prospect:<slug>        → a ficha (JSON)
//   prospects:index        → SET com os slugs que têm ficha
//   prospect-reads:<slug>  → HASH username → epoch ms da última abertura
//
// As aberturas vivem numa chave à parte, num hash: marcar «li a ficha» é um
// HSET de um campo e nunca reescreve a ficha — abrir a página ao mesmo tempo
// que alguém grava uma nota não pode apagar a nota.
//
// MODO MEMÓRIA: em desenvolvimento (o .env.local aponta para o KV de
// PRODUÇÃO) e sem KV, tudo vive num Map do processo. Testar a ficha em local
// nunca escreve na base verdadeira. `PROSPECTS_LIVE_KV=1` força o KV real.

import "server-only";
import { kv } from "@vercel/kv";
import {
  emptyProspectFile,
  hydrateProspectFile,
  type ProspectFile,
} from "./shared";
import { applyProspectOp, type ApplyResult, type ProspectActor } from "./ops";

const fileKey = (slug: string) => `prospect:${slug}`;
const readsKey = (slug: string) => `prospect-reads:${slug}`;
const INDEX = "prospects:index";

const kvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const memoryMode =
  !kvConfigured ||
  (process.env.NODE_ENV !== "production" && process.env.PROSPECTS_LIVE_KV !== "1");

type MemoryDb = {
  files: Map<string, ProspectFile>;
  reads: Map<string, Record<string, number>>;
};
const g = globalThis as unknown as { __prospectsMemory?: MemoryDb };
function mem(): MemoryDb {
  g.__prospectsMemory ??= { files: new Map(), reads: new Map() };
  return g.__prospectsMemory;
}

/** Lê e DEIXA o erro subir — para quem escreve a seguir. */
async function readStrict(slug: string): Promise<ProspectFile | null> {
  if (memoryMode) return mem().files.get(slug) ?? null;
  return hydrateProspectFile(await kv.get<unknown>(fileKey(slug)), slug);
}

async function write(file: ProspectFile): Promise<void> {
  if (memoryMode) {
    mem().files.set(file.slug, file);
    return;
  }
  await kv.set(fileKey(file.slug), file);
  await kv.sadd(INDEX, file.slug);
}

/** Para mostrar: uma falha do KV dá null (a página mostra a ficha vazia
 *  em modo só de leitura — ver `loadFailed` em quem chama). */
export async function getProspectFile(
  slug: string,
): Promise<{ file: ProspectFile | null; failed: boolean }> {
  try {
    return { file: await readStrict(slug), failed: false };
  } catch (err) {
    console.error("KV prospect read failed:", err);
    return { file: null, failed: true };
  }
}

/** Todas as fichas — para a lista /prospects. */
export async function listProspectFiles(): Promise<ProspectFile[]> {
  if (memoryMode) return [...mem().files.values()];
  try {
    const slugs = (await kv.smembers(INDEX)) as string[];
    if (!slugs?.length) return [];
    const raws = await kv.mget<unknown[]>(...slugs.map(fileKey));
    return raws
      .map((raw, i) => hydrateProspectFile(raw, slugs[i]))
      .filter((f): f is ProspectFile => Boolean(f));
  } catch (err) {
    console.error("KV prospects list failed:", err);
    return [];
  }
}

/** Cria a ficha vazia quando um onboarding nasce. Nunca pisa uma que já
 *  existe (um onboarding recriado com o mesmo nome guarda as notas). */
export async function ensureProspectFile(
  slug: string,
  title: string,
  createdBy: string,
  owner: string | null,
): Promise<ProspectFile> {
  const existing = await readStrict(slug);
  if (existing) {
    if (owner && !existing.owner) {
      const patched = { ...existing, owner };
      await write(patched);
      return patched;
    }
    return existing;
  }
  const file = emptyProspectFile(slug, title, createdBy, owner);
  file.activity = [{ at: file.createdAt, by: createdBy, text: "criou a ficha com o onboarding" }];
  await write(file);
  return file;
}

/** Aplica uma operação sobre a versão acabada de ler. Sem ficha ainda (um
 *  onboarding de antes da v80), a primeira escrita cria-a com `seed`. */
export async function applyToProspectFile(
  slug: string,
  op: unknown,
  actor: ProspectActor,
  seed: { title: string },
  validOwners: Set<string>,
): Promise<ApplyResult> {
  const current =
    (await readStrict(slug)) ?? emptyProspectFile(slug, seed.title, actor.username);
  const result = applyProspectOp(current, op, actor, { validOwners });
  if (result.ok && result.file !== current) await write(result.file);
  return result;
}

// ── Quem já leu ─────────────────────────────────────────────────────────

export async function getProspectReads(slug: string): Promise<Record<string, number>> {
  if (memoryMode) return { ...(mem().reads.get(slug) ?? {}) };
  try {
    const raw = await kv.hgetall<Record<string, unknown>>(readsKey(slug));
    const out: Record<string, number> = {};
    for (const [u, v] of Object.entries(raw ?? {})) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) out[u] = n;
    }
    return out;
  } catch (err) {
    console.error("KV prospect reads failed:", err);
    return {};
  }
}

export async function getProspectReadsMany(
  slugs: string[],
): Promise<Record<string, Record<string, number>>> {
  const entries = await Promise.all(
    slugs.map(async (s) => [s, await getProspectReads(s)] as const),
  );
  return Object.fromEntries(entries);
}

export async function markProspectRead(slug: string, username: string, at = Date.now()): Promise<void> {
  if (memoryMode) {
    const cur = mem().reads.get(slug) ?? {};
    mem().reads.set(slug, { ...cur, [username]: at });
    return;
  }
  await kv.hset(readsKey(slug), { [username]: at });
}
