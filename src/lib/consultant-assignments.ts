// Migração de clientes entre consultores de SEO (v77.34).
//
// A carteira de cada consultor nasceu escrita em código (os Sets de
// client-overrides.ts). Um SuperAdmin pode agora passar um cliente para
// outro consultor a partir do cartão na board do /seo — a migração fica
// num único mapa no KV (`slug → consultor`) que ganha a tudo o resto.
//
// ORDEM DE RESOLUÇÃO (uma só, para a app inteira):
//   1. migração no KV (SuperAdmin, na board)
//   2. carteira em código (client-overrides.ts)
//   3. a atribuição que veio com o cliente (registo de onboarding / cache)
//
// Todas as superfícies que mostram o consultor — a board, os roadmaps, os
// rodapés «Dúvidas? Envia email a …» das páginas públicas, os PDFs/DOCX, o
// relatório mensal, o NPS, as propostas — passam por aqui. Nunca pelos
// defaults síncronos de client-overrides.ts.

import "server-only";
import { cache } from "react";
import { kv } from "@vercel/kv";
import {
  CONSULTANT_ORDER,
  consultantEmailByName,
  defaultConsultantForSlug,
} from "@/lib/client-overrides";

const KEY = "seo-consultant-assignments";
const LOG_KEY = "seo-consultant-assignments:log";
const MAX_LOG = 300;

export type ConsultantAssignment = {
  slug: string;
  /** Nome de exibição do consultor novo (um dos CONSULTANT_ORDER). */
  consultant: string;
  /** Quem tinha o cliente antes desta migração. */
  previous: string;
  /** Epoch ms. */
  movedAt: number;
  /** Username de quem migrou. */
  movedBy: string;
};

const storageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** O mapa inteiro de migrações — uma leitura KV por pedido (React cache). */
export const getConsultantAssignments = cache(
  async (): Promise<Record<string, ConsultantAssignment>> => {
    if (!storageConfigured) return {};
    try {
      const raw = await kv.get<Record<string, ConsultantAssignment>>(KEY);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const out: Record<string, ConsultantAssignment> = {};
      for (const [slug, a] of Object.entries(raw)) {
        if (a && typeof a.consultant === "string" && a.consultant) {
          out[slug] = { ...a, slug };
        }
      }
      return out;
    } catch (err) {
      console.error("seo-consultant-assignments read failed:", err);
      return {};
    }
  },
);

export type ConsultantResolver = {
  /** Consultor do cliente, ou "Unassigned". */
  consultantFor(slug: string): string;
  /** Igual, mas com a atribuição que veio com o cliente como rede. */
  resolve(slug: string, fallback: string | null | undefined): string;
  /** Email de trabalho do consultor do cliente (seo@ quando não há). */
  emailFor(slug: string): string;
};

function buildResolver(
  assignments: Record<string, ConsultantAssignment>,
): ConsultantResolver {
  const consultantFor = (slug: string) =>
    assignments[slug]?.consultant ?? defaultConsultantForSlug(slug);
  return {
    consultantFor,
    resolve(slug, fallback) {
      const known = consultantFor(slug);
      if (known !== "Unassigned") return known;
      const f = typeof fallback === "string" ? fallback.trim() : "";
      return f || "Unassigned";
    },
    emailFor: (slug) => consultantEmailByName(consultantFor(slug)),
  };
}

/** Para loops (board, roadmaps, notificações): uma leitura, N resoluções. */
export async function getConsultantResolver(): Promise<ConsultantResolver> {
  return buildResolver(await getConsultantAssignments());
}

/** O Head Consultant de um cliente, com as migrações aplicadas. */
export async function getConsultantForSlug(slug: string): Promise<string> {
  return (await getConsultantResolver()).consultantFor(slug);
}

/** O email do Head Consultant — vai nos entregáveis (PDF/DOCX), nos rodapés
 *  das páginas públicas e no relatório mensal. */
export async function getConsultantEmailForSlug(slug: string): Promise<string> {
  return (await getConsultantResolver()).emailFor(slug);
}

/** O consultor em vigor, com rede para os clientes que entraram pelo
 *  onboarding e não estão em client-overrides.ts (ver v76.47). */
export async function resolveConsultant(
  slug: string,
  fallback: string | null | undefined,
): Promise<string> {
  return (await getConsultantResolver()).resolve(slug, fallback);
}

/** Passa um cliente para outro consultor. Quando o destino é o dono em
 *  código, a migração é apagada (volta ao default) em vez de ficar
 *  duplicada no KV. Devolve o consultor anterior. */
export async function assignConsultant(
  slug: string,
  consultant: string,
  movedBy: string,
  previousFallback?: string | null,
): Promise<{ previous: string; consultant: string }> {
  if (!storageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  if (!(CONSULTANT_ORDER as readonly string[]).includes(consultant)) {
    throw new Error(`Consultor desconhecido: ${consultant}`);
  }
  // Lido direto (sem a cache do pedido) — escrita a seguir.
  const raw = await kv.get<Record<string, ConsultantAssignment>>(KEY);
  const current: Record<string, ConsultantAssignment> =
    raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  const previous = buildResolver(current).resolve(slug, previousFallback);

  if (defaultConsultantForSlug(slug) === consultant) {
    delete current[slug];
  } else {
    current[slug] = {
      slug,
      consultant,
      previous,
      movedAt: Date.now(),
      movedBy,
    };
  }
  await kv.set(KEY, current);

  try {
    const log = (await kv.get<ConsultantAssignment[]>(LOG_KEY)) ?? [];
    const entry: ConsultantAssignment = {
      slug,
      consultant,
      previous,
      movedAt: Date.now(),
      movedBy,
    };
    await kv.set(
      LOG_KEY,
      [entry, ...(Array.isArray(log) ? log : [])].slice(0, MAX_LOG),
    );
  } catch (err) {
    // O histórico é auditoria, não pode falhar a migração.
    console.error("seo-consultant-assignments log write failed:", err);
  }

  return { previous, consultant };
}
