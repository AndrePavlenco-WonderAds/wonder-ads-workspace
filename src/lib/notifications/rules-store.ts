// Persistência das regras de notificação — um único blob em KV.
//
// Mesmo padrão do catálogo da Formação: o seed vive em código
// (`DEFAULT_NOTIFICATION_RULES`), o Superadmin grava um override, e um
// override inválido nunca consegue partir a app (cai-se para o default).
//
// ATENÇÃO — O OVERRIDE VENCE O CÓDIGO. Assim que alguém grava no Superadmin,
// as regras passam a vir de KV e uma regra nova adicionada em código deixa de
// aparecer até se repor os defaults. É o comportamento correto (senão uma
// alteração no repositório desfazia o que a gestão configurou), mas explica
// porque é que uma regra pode "não aparecer" depois de um deploy.
//
// Chave vazia gravada (`[]`) é diferente de chave ausente: `[]` significa
// "não quero notificações nenhumas" e vence os defaults.

import { kv } from "@vercel/kv";
import {
  DEFAULT_NOTIFICATION_RULES,
  normalizeRules,
  type NotificationRule,
} from "@/lib/notifications/rules";

const KEY = "notification-rules";

export const notificationsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getNotificationRules(): Promise<NotificationRule[]> {
  if (!notificationsStorageConfigured) return DEFAULT_NOTIFICATION_RULES;
  try {
    const stored = await kv.get<unknown>(KEY);
    if (stored == null) return DEFAULT_NOTIFICATION_RULES;
    return normalizeRules(stored) ?? DEFAULT_NOTIFICATION_RULES;
  } catch (err) {
    console.error("KV notification-rules read failed:", err);
    return DEFAULT_NOTIFICATION_RULES;
  }
}

/** True quando existe um override gravado (o painel mostra "personalizado"). */
export async function notificationRulesAreCustom(): Promise<boolean> {
  if (!notificationsStorageConfigured) return false;
  try {
    return (await kv.get<unknown>(KEY)) != null;
  } catch {
    return false;
  }
}

export async function saveNotificationRules(
  raw: unknown,
): Promise<NotificationRule[]> {
  if (!notificationsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const normalized = normalizeRules(raw);
  if (!normalized) {
    throw new Error(
      "Estrutura das regras inválida (ids repetidos ou formato desconhecido).",
    );
  }
  await kv.set(KEY, normalized);
  return normalized;
}

/** Repõe as regras de origem (apaga o override). */
export async function resetNotificationRules(): Promise<void> {
  if (!notificationsStorageConfigured) return;
  await kv.del(KEY);
}
