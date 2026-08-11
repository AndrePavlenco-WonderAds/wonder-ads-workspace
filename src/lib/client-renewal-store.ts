// Renovação do contrato de um cliente — a data em que renova e por quantos
// meses.
//
// PORQUE NÃO VIVE DENTRO DO ROADMAP, apesar de aparecer na barra dele: um
// roadmap é reiniciado e arquivado quando um plano se esgota, e o que lá
// estava vai com ele. Foi o que aconteceu à data de onboarding antes da
// v76.36 — estava presa ao blob do roadmap e desaparecia a cada reinício,
// e a app teve de aprender a resolvê-la a partir de outro sítio.
//
// A renovação é um facto COMERCIAL do cliente, não do plano de trabalho:
// sobrevive a reinícios, a mudanças de consultor e a roadmaps novos. Por
// isso tem chave própria, `client-renewal:<slug>`.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "client-renewal:";

/** Períodos de renovação que a casa pratica. */
export const RENEWAL_TERMS = [3, 6, 9, 12] as const;
export type RenewalTerm = (typeof RENEWAL_TERMS)[number];

export type ClientRenewal = {
  /** ISO yyyy-mm-dd — o dia em que o contrato renova. null = por definir. */
  renewalDate: string | null;
  /** Por quantos meses renova. */
  termMonths: RenewalTerm;
  updatedAt: number;
  /** Quem gravou — o histórico de quem mexeu numa data comercial importa. */
  updatedBy: string | null;
};

export const renewalStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

const EMPTY: ClientRenewal = {
  renewalDate: null,
  termMonths: 6,
  updatedAt: 0,
  updatedBy: null,
};

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

function normalize(raw: unknown): ClientRenewal {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const o = raw as Record<string, unknown>;
  const date =
    typeof o.renewalDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.renewalDate)
      ? o.renewalDate
      : null;
  const term = (RENEWAL_TERMS as readonly number[]).includes(
    o.termMonths as number,
  )
    ? (o.termMonths as RenewalTerm)
    : EMPTY.termMonths;
  return {
    renewalDate: date,
    termMonths: term,
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : 0,
    updatedBy: typeof o.updatedBy === "string" ? o.updatedBy : null,
  };
}

export async function getClientRenewal(slug: string): Promise<ClientRenewal> {
  if (!renewalStorageConfigured) return { ...EMPTY };
  try {
    return normalize(await kv.get<unknown>(key(slug)));
  } catch (err) {
    console.error("renovação: leitura falhou:", err);
    return { ...EMPTY };
  }
}

export async function saveClientRenewal(
  slug: string,
  patch: { renewalDate?: string | null; termMonths?: number },
  updatedBy: string | null,
): Promise<ClientRenewal> {
  if (!renewalStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getClientRenewal(slug);
  const next = normalize({
    ...current,
    ...patch,
    updatedAt: Date.now(),
    updatedBy,
  });
  await kv.set(key(slug), next);
  return next;
}

/** Dias que faltam até à renovação. Negativo = já passou. null sem data.
 *  Contado em dias de calendário (meia-noite a meia-noite), que é como uma
 *  pessoa conta — «renova amanhã» não pode depender da hora a que se abre a
 *  página. */
export function daysUntilRenewal(
  renewalDate: string | null,
  now: Date = new Date(),
): number | null {
  if (!renewalDate) return null;
  const target = new Date(`${renewalDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** A data seguinte depois de renovar, somando o período contratado. Serve o
 *  botão «renovou — passar para a próxima»: sem isto, alguém teria de contar
 *  seis meses de cabeça e enganar-se nos meses de 31 dias. */
export function nextRenewalDate(
  renewalDate: string,
  termMonths: number,
): string {
  const d = new Date(`${renewalDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return renewalDate;
  const target = new Date(d.getFullYear(), d.getMonth() + termMonths, 1);
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
