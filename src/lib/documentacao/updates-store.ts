// O registo das alterações feitas NA APP às páginas da Documentação
// (v78.62). Ver updates.ts para o desenho todo.
//
// Uma lista KV (`docs:updates`), a mais recente à frente (lpush + ltrim).
// Edições seguidas da mesma pessoa na mesma página (a lista grava a cada
// mudança) juntam-se no mesmo aviso durante `COALESCE_MS`: guarda-se a
// versão de ANTES da primeira edição (`docs:updates:base:<id>`) e o aviso
// mostra sempre a diferença entre essa e a atual — acrescentar e depois
// apagar a mesma regra não deixa rasto; desfazer tudo retira o aviso.

import "server-only";
import { kv } from "@vercel/kv";
import { codeDocUpdates } from "./updates-log";
import { DOC_UPDATE_KIND_LABEL, type ChangeSummary, type DocUpdate, type DocUpdateKind } from "./updates";

const KEY = "docs:updates";
const baseKey = (id: string) => `docs:updates:base:${id}`;
const MAX_KEPT = 200;
/** Janela em que edições seguidas contam como uma só alteração. */
const COALESCE_MS = 30 * 60 * 1000;
/** A versão de antes vive um pouco mais do que a janela. */
const BASE_TTL_S = 2 * 60 * 60;

const configured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type Stored = DocUpdate & { retracted?: boolean };

function parse(raw: unknown): Stored | null {
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
  if (typeof o.id !== "string" || typeof o.page !== "string" || typeof o.at !== "number") return null;
  if (!(typeof o.kind === "string" && o.kind in DOC_UPDATE_KIND_LABEL)) return null;
  return {
    id: o.id,
    page: o.page,
    ...(typeof o.blockId === "string" ? { blockId: o.blockId } : {}),
    kind: o.kind as DocUpdateKind,
    changes: Array.isArray(o.changes) ? o.changes.filter((c): c is string => typeof c === "string") : [],
    by: typeof o.by === "string" ? o.by : "Direção",
    byUsername: typeof o.byUsername === "string" ? o.byUsername : null,
    source: "app",
    at: o.at,
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : o.at,
    ...(typeof o.anchor === "string" ? { anchor: o.anchor } : {}),
    ...(o.retracted === true ? { retracted: true } : {}),
  };
}

async function listStored(): Promise<Stored[]> {
  if (!configured) return [];
  const rows = await kv.lrange<unknown>(KEY, 0, MAX_KEPT - 1);
  return rows.map(parse).filter((u): u is Stored => u !== null);
}

/** Todas as alterações (app + código), a mais recente à frente. Lança se o
 *  KV falhar — quem chama decide (o sino engole, a página também). */
export async function listDocUpdates(): Promise<DocUpdate[]> {
  const stored = await listStored();
  return [...stored.filter((u) => !u.retracted), ...codeDocUpdates()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** As de uma página, a mais recente à frente. Nunca lança. */
export async function listDocUpdatesForPage(page: string): Promise<DocUpdate[]> {
  try {
    return (await listDocUpdates()).filter((u) => u.page === page);
  } catch (err) {
    console.error("docs updates read failed:", err instanceof Error ? err.message : err);
    return codeDocUpdates().filter((u) => u.page === page);
  }
}

/** Regista uma edição feita na app. `describe` calcula o que mudou entre
 *  duas versões do documento. Nunca lança: uma falha aqui não pode desfazer
 *  a gravação do documento, que já aconteceu. */
export async function recordDocEdit<T>({
  page,
  before,
  after,
  by,
  byUsername,
  describe,
  anchor,
}: {
  page: string;
  before: T;
  after: T;
  by: string;
  byUsername: string;
  describe: (before: T, after: T) => ChangeSummary;
  anchor?: string;
}): Promise<void> {
  if (!configured) return;
  try {
    const now = Date.now();
    const head = await kv.lrange<unknown>(KEY, 0, 9);
    const recent = head.map(parse);
    const i = recent.findIndex(
      (u) => u && !u.retracted && u.page === page && u.byUsername === byUsername && now - u.updatedAt <= COALESCE_MS,
    );
    const open = i >= 0 ? recent[i]! : null;
    const baseline = open ? await kv.get<T>(baseKey(open.id)) : null;

    if (open && baseline) {
      // Junta-se ao aviso aberto: a diferença é sempre contra a versão de
      // antes da primeira edição.
      const summary = describe(baseline, after);
      const next: Stored = summary.changes.length
        ? { ...open, changes: summary.changes, kind: summary.kind, updatedAt: now }
        : { ...open, retracted: true, updatedAt: now };
      // A lista pode ter andado entre a leitura e a escrita: confirma o id.
      const still = parse(await kv.lindex(KEY, i));
      if (still?.id === open.id) {
        await kv.lset(KEY, i, JSON.stringify(next));
        await kv.expire(baseKey(open.id), BASE_TTL_S);
        return;
      }
    }

    const summary = describe(before, after);
    if (!summary.changes.length) return;
    const id = `du-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: Stored = {
      id,
      page,
      kind: summary.kind,
      changes: summary.changes,
      by,
      byUsername,
      source: "app",
      at: now,
      updatedAt: now,
      ...(anchor ? { anchor } : {}),
    };
    await kv.set(baseKey(id), before, { ex: BASE_TTL_S });
    await kv.lpush(KEY, JSON.stringify(entry));
    await kv.ltrim(KEY, 0, MAX_KEPT - 1);
  } catch (err) {
    console.error("docs updates write failed:", err instanceof Error ? err.message : err);
  }
}
