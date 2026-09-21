// O que cada pessoa já resolveu — a única coisa que se escreve, porque é a
// única que não se consegue derivar do calendário.
//
// Uma chave por utilizador (`notification-state:<username>`): as notificações
// de uma pessoa não interessam a mais ninguém, e assim o registo do consultor
// com mais clientes não fica no caminho do de quem tem dois.
//
// Guarda-se um mapa `id → { resolvedAt, note }`. Só entram ids que o motor
// gerou para aquele utilizador — sem isso, um POST forjado podia encher a
// chave com lixo indefinidamente.

import { kv } from "@vercel/kv";

export type ResolvedEntry = {
  resolvedAt: number;
  /** Quem a limpou, quando não foi a própria pessoa — o Superadmin a limpar
   *  pelo painel de equipa (v77.40). Ausente nas que a pessoa concluiu. */
  by?: string;
};

export type NotificationState = Record<string, ResolvedEntry>;

/** Teto de segurança: 2 meses de lookback × carteira grande fica muito abaixo
 *  disto. Serve para que uma regra mal configurada não faça a chave crescer
 *  sem fim. Ao atingir o limite descartam-se as entradas mais antigas. */
const MAX_ENTRIES = 400;

export const notificationStateConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function stateKey(username: string): string {
  return `notification-state:${username}`;
}

function normalize(raw: unknown): NotificationState {
  if (!raw || typeof raw !== "object") return {};
  const out: NotificationState = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const at = (value as Record<string, unknown>).resolvedAt;
    if (typeof at !== "number" || !Number.isFinite(at)) continue;
    const by = (value as Record<string, unknown>).by;
    out[id] = typeof by === "string" ? { resolvedAt: at, by } : { resolvedAt: at };
  }
  return out;
}

export async function getNotificationState(
  username: string,
): Promise<NotificationState> {
  if (!notificationStateConfigured) return {};
  try {
    return normalize(await kv.get<unknown>(stateKey(username)));
  } catch (err) {
    console.error("KV notification-state read failed:", err);
    return {};
  }
}

/** Estado de várias pessoas numa só operação KV — o painel de equipa do
 *  Superadmin precisa das 13 chaves de uma vez, e 13 `get` em série no meio
 *  de um render de header é o tipo de coisa que faz o workspace inteiro
 *  parecer lento. */
export async function getNotificationStateMany(
  usernames: string[],
): Promise<Record<string, NotificationState>> {
  const out: Record<string, NotificationState> = {};
  if (!usernames.length) return out;
  if (!notificationStateConfigured) {
    for (const u of usernames) out[u] = {};
    return out;
  }
  try {
    const rows = await kv.mget<unknown[]>(...usernames.map(stateKey));
    usernames.forEach((u, i) => {
      out[u] = normalize(rows?.[i]);
    });
  } catch (err) {
    console.error("KV notification-state mget failed:", err);
    for (const u of usernames) out[u] = {};
  }
  return out;
}

/** Marca (ou desmarca) uma notificação como concluída. Devolve o estado novo. */
export async function setNotificationResolved(
  username: string,
  id: string,
  resolved: boolean,
  nowMs: number,
): Promise<NotificationState> {
  if (!notificationStateConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getNotificationState(username);
  const next: NotificationState = { ...current };
  if (resolved) next[id] = { resolvedAt: nowMs };
  else delete next[id];
  return writeState(username, next);
}

/** Marca várias notificações de uma pessoa como concluídas de uma vez — o
 *  «Limpar» do Superadmin no painel de equipa. Uma leitura e uma escrita,
 *  seja um id ou trinta. */
export async function resolveNotificationsMany(
  username: string,
  ids: string[],
  nowMs: number,
  by: string,
): Promise<NotificationState> {
  if (!notificationStateConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getNotificationState(username);
  const next: NotificationState = { ...current };
  for (const id of ids) next[id] = { resolvedAt: nowMs, by };
  return writeState(username, next);
}

async function writeState(
  username: string,
  next: NotificationState,
): Promise<NotificationState> {
  const ids = Object.keys(next);
  if (ids.length > MAX_ENTRIES) {
    const keep = ids
      .sort((a, b) => next[b].resolvedAt - next[a].resolvedAt)
      .slice(0, MAX_ENTRIES);
    const trimmed: NotificationState = {};
    for (const k of keep) trimmed[k] = next[k];
    await kv.set(stateKey(username), trimmed);
    return trimmed;
  }

  await kv.set(stateKey(username), next);
  return next;
}
