// Confirmações de propostas — o registo de quem clicou em «Confirmar a
// renovação» numa proposta pública. Vive numa chave só (`proposal-confirmations`)
// porque são poucas por ano e o sino lê a lista inteira de cada vez.

import { kv } from "@vercel/kv";

const KEY = "proposal-confirmations";
const MAX = 200;

export type ProposalConfirmation = {
  id: string;
  proposalSlug: string;
  clientSlug: string | null;
  clientName: string;
  /** epoch ms */
  at: number;
  userAgent: string | null;
};

export const proposalEventsConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function normalize(raw: unknown): ProposalConfirmation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => ({
      id: String(r.id ?? ""),
      proposalSlug: String(r.proposalSlug ?? ""),
      clientSlug: typeof r.clientSlug === "string" ? r.clientSlug : null,
      clientName: String(r.clientName ?? ""),
      at: typeof r.at === "number" ? r.at : 0,
      userAgent: typeof r.userAgent === "string" ? r.userAgent : null,
    }))
    .filter((r) => r.id && r.proposalSlug);
}

export async function listProposalConfirmations(): Promise<ProposalConfirmation[]> {
  if (!proposalEventsConfigured) return [];
  try {
    return normalize(await kv.get<unknown>(KEY));
  } catch (err) {
    console.error("propostas: leitura das confirmações falhou:", err);
    return [];
  }
}

export async function recordProposalConfirmation(input: {
  proposalSlug: string;
  clientSlug: string | null;
  clientName: string;
  userAgent: string | null;
}): Promise<ProposalConfirmation | null> {
  if (!proposalEventsConfigured) return null;
  const list = await listProposalConfirmations();
  const now = Date.now();
  // Dois cliques seguidos na mesma proposta são uma confirmação, não duas.
  const recent = list.find(
    (c) => c.proposalSlug === input.proposalSlug && now - c.at < 10 * 60_000,
  );
  if (recent) return recent;
  const entry: ProposalConfirmation = {
    id: `${input.proposalSlug}-${now.toString(36)}`,
    proposalSlug: input.proposalSlug,
    clientSlug: input.clientSlug,
    clientName: input.clientName,
    at: now,
    userAgent: input.userAgent ? input.userAgent.slice(0, 200) : null,
  };
  await kv.set(KEY, [entry, ...list].slice(0, MAX));
  return entry;
}
