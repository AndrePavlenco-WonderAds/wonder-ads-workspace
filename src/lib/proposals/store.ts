// O que o departamento Comercial escreve POR CIMA das propostas — e as
// propostas que entram por upload (PDF preparado pelo consultor).
//
// Duas chaves de KV, de propósito:
//   proposals:overrides → por slug, o tipo editado (Renovação ↔ Cross-sell)
//                         e a decisão do cliente (aceitou / recusou / anulada).
//                         Serve tanto as propostas em código como as de upload.
//   proposals:uploads   → a lista das propostas carregadas em PDF, com os
//                         metadados que o Claude extraiu e o consultor reviu.
//
// PORQUE NÃO SE ESCREVE NO REGISTO EM CÓDIGO: uma decisão do cliente é um
// facto do dia — «aceitou a 8/9» — não é uma edição ao documento. Mudar o
// ficheiro de metadados e fazer deploy para registar um «sim» era o que
// ninguém ia fazer. Fica em KV, com quem e quando, e a lista lê os dois.

import { kv } from "@vercel/kv";
import {
  PROPOSALS,
  isProposalKind,
  type ProposalKind,
  type ProposalMeta,
  type ProposalStatus,
} from "./index";

const OVERRIDES_KEY = "proposals:overrides";
const UPLOADS_KEY = "proposals:uploads";
const MAX_UPLOADS = 300;

export const proposalsStoreConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type ProposalDecision = {
  status: Extract<ProposalStatus, "aceite" | "recusada">;
  /** epoch ms */
  at: number;
  by: string;
  byName: string;
};

export type ProposalOverride = {
  kind: ProposalKind | null;
  decision: ProposalDecision | null;
  updatedAt: number | null;
};

export type ProposalFile = {
  url: string;
  name: string;
  size: number;
  type: string;
  pages: number | null;
};

export type UploadedProposal = ProposalMeta & {
  /** Username de quem assina (o seletor do upload); o nome fica em
   *  `consultant` para a lista não depender das credenciais. */
  consultantUsername: string | null;
  file: ProposalFile;
  uploadedAt: number;
  uploadedBy: string;
  uploadedByName: string;
};

export type ProposalSource = "code" | "upload";

/** Uma proposta tal como a lista do Comercial a vê: metadados + o que o
 *  KV escreveu por cima + de onde veio. */
export type ProposalRecord = ProposalMeta & {
  source: ProposalSource;
  consultantUsername: string | null;
  decision: ProposalDecision | null;
  file: ProposalFile | null;
  uploadedAt: number | null;
  uploadedByName: string | null;
};

// ---------------------------------------------------------------- hydrate

function hydrateDecision(raw: unknown): ProposalDecision | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.status !== "aceite" && o.status !== "recusada") return null;
  return {
    status: o.status,
    at: typeof o.at === "number" ? o.at : 0,
    by: typeof o.by === "string" ? o.by : "",
    byName: typeof o.byName === "string" ? o.byName : "",
  };
}

function hydrateOverride(raw: unknown): ProposalOverride {
  if (!raw || typeof raw !== "object") return { kind: null, decision: null, updatedAt: null };
  const o = raw as Record<string, unknown>;
  return {
    kind: isProposalKind(o.kind) ? o.kind : null,
    decision: hydrateDecision(o.decision),
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : null,
  };
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function hydrateUpload(raw: unknown): UploadedProposal | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const slug = str(o.slug);
  const file = o.file && typeof o.file === "object" ? (o.file as Record<string, unknown>) : null;
  if (!slug || !file || typeof file.url !== "string") return null;
  const status = o.status;
  return {
    slug,
    clientSlug: typeof o.clientSlug === "string" && o.clientSlug ? o.clientSlug : null,
    clientName: str(o.clientName, "Cliente"),
    title: str(o.title, "Proposta"),
    kind: isProposalKind(o.kind) ? o.kind : "renovacao",
    status:
      status === "rascunho" || status === "enviada" || status === "aceite" || status === "recusada"
        ? status
        : "enviada",
    date: str(o.date, new Date().toISOString().slice(0, 10)),
    period: str(o.period),
    consultant: str(o.consultant),
    summary: str(o.summary),
    investment: str(o.investment),
    consultantUsername: typeof o.consultantUsername === "string" ? o.consultantUsername : null,
    file: {
      url: file.url,
      name: str(file.name, "proposta.pdf"),
      size: typeof file.size === "number" ? file.size : 0,
      type: str(file.type, "application/pdf"),
      pages: typeof file.pages === "number" ? file.pages : null,
    },
    uploadedAt: typeof o.uploadedAt === "number" ? o.uploadedAt : 0,
    uploadedBy: str(o.uploadedBy),
    uploadedByName: str(o.uploadedByName),
  };
}

// ------------------------------------------------------------------ reads

export async function getProposalOverrides(): Promise<Record<string, ProposalOverride>> {
  if (!proposalsStoreConfigured) return {};
  try {
    const raw = await kv.get<unknown>(OVERRIDES_KEY);
    if (!raw || typeof raw !== "object") return {};
    const out: Record<string, ProposalOverride> = {};
    for (const [slug, v] of Object.entries(raw as Record<string, unknown>)) {
      out[slug] = hydrateOverride(v);
    }
    return out;
  } catch (err) {
    console.error("propostas: leitura dos overrides falhou:", err);
    return {};
  }
}

export async function listUploadedProposals(): Promise<UploadedProposal[]> {
  if (!proposalsStoreConfigured) return [];
  try {
    const raw = await kv.get<unknown>(UPLOADS_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.map(hydrateUpload).filter((u): u is UploadedProposal => Boolean(u));
  } catch (err) {
    console.error("propostas: leitura dos uploads falhou:", err);
    return [];
  }
}

function applyOverride(
  base: ProposalMeta,
  source: ProposalSource,
  extra: Partial<Pick<ProposalRecord, "consultantUsername" | "file" | "uploadedAt" | "uploadedByName">>,
  ov: ProposalOverride | undefined,
): ProposalRecord {
  const decision = ov?.decision ?? null;
  return {
    ...base,
    kind: ov?.kind ?? base.kind,
    // A decisão registada no Comercial manda sobre o estado escrito.
    status: decision ? decision.status : base.status,
    source,
    consultantUsername: extra.consultantUsername ?? null,
    decision,
    file: extra.file ?? null,
    uploadedAt: extra.uploadedAt ?? null,
    uploadedByName: extra.uploadedByName ?? null,
  };
}

/** Todas as propostas — código + uploads — com o KV por cima, da mais
 *  recente para a mais antiga. É esta que o Comercial lista. */
export async function listAllProposals(): Promise<ProposalRecord[]> {
  const [overrides, uploads] = await Promise.all([getProposalOverrides(), listUploadedProposals()]);
  const fromCode = PROPOSALS.map((p) => applyOverride(p, "code", {}, overrides[p.slug]));
  const fromUploads = uploads.map((u) =>
    applyOverride(
      u,
      "upload",
      {
        consultantUsername: u.consultantUsername,
        file: u.file,
        uploadedAt: u.uploadedAt,
        uploadedByName: u.uploadedByName,
      },
      overrides[u.slug],
    ),
  );
  return [...fromCode, ...fromUploads].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0);
  });
}

export async function getProposalRecord(slug: string): Promise<ProposalRecord | null> {
  const all = await listAllProposals();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getProposalsForClientAll(clientSlug: string): Promise<ProposalRecord[]> {
  return (await listAllProposals()).filter((p) => p.clientSlug === clientSlug);
}

// ----------------------------------------------------------------- writes

async function saveOverride(slug: string, patch: Partial<ProposalOverride>): Promise<ProposalOverride> {
  const all = await getProposalOverrides();
  const next: ProposalOverride = {
    ...(all[slug] ?? { kind: null, decision: null, updatedAt: null }),
    ...patch,
    updatedAt: Date.now(),
  };
  await kv.set(OVERRIDES_KEY, { ...all, [slug]: next });
  return next;
}

export async function setProposalKind(slug: string, kind: ProposalKind): Promise<void> {
  await saveOverride(slug, { kind });
}

/** Regista a resposta do cliente; `null` anula (volta a «enviada»). */
export async function setProposalDecision(
  slug: string,
  decision: ProposalDecision | null,
): Promise<void> {
  await saveOverride(slug, { decision });
}

/** Slug único para um upload: <cliente>-<tipo>[-2, -3…]. */
export function uniqueProposalSlug(base: string, taken: Set<string>): string {
  const clean =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "proposta";
  if (!taken.has(clean)) return clean;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${clean}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${clean}-${Date.now().toString(36)}`;
}

export async function addUploadedProposal(
  input: Omit<UploadedProposal, "slug"> & { slug?: string },
): Promise<UploadedProposal> {
  const list = await listUploadedProposals();
  const taken = new Set<string>([...PROPOSALS.map((p) => p.slug), ...list.map((u) => u.slug)]);
  const slug = uniqueProposalSlug(
    input.slug ?? `${input.clientName}-${input.kind === "renovacao" ? "renovacao" : "cross-sell"}`,
    taken,
  );
  const record: UploadedProposal = { ...input, slug };
  await kv.set(UPLOADS_KEY, [record, ...list].slice(0, MAX_UPLOADS));
  return record;
}

export async function removeUploadedProposal(slug: string): Promise<boolean> {
  const list = await listUploadedProposals();
  const next = list.filter((u) => u.slug !== slug);
  if (next.length === list.length) return false;
  await kv.set(UPLOADS_KEY, next);
  const overrides = await getProposalOverrides();
  if (overrides[slug]) {
    const { [slug]: _dropped, ...rest } = overrides;
    void _dropped;
    await kv.set(OVERRIDES_KEY, rest);
  }
  return true;
}
