// Motor das notificações — server-only. Junta regras + calendário + carteira
// do consultor + estado de "concluída" e devolve a lista pronta para o sino.
//
// A carteira SEO é re-resolvida a partir do slug (`getConsultantForSlug`) e
// nunca do campo `consultant` que vem em cache: `getSeoClients()` está dentro
// de um `unstable_cache` de 1h, e uma passagem de cliente entre consultores
// ficaria a apontar à pessoa errada durante uma hora. O mesmo cuidado que a
// board do SEO já tem.

import "server-only";
import { getSeoClients } from "@/lib/notion";
import { getConsultantForSlug } from "@/lib/client-overrides";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import { getNotificationRules } from "@/lib/notifications/rules-store";
import { getNotificationState } from "@/lib/notifications/state-store";
import {
  audienceMatches,
  notificationId,
  occurrencesFor,
  resolveHref,
  type NotificationRule,
} from "@/lib/notifications/rules";

export type UserNotification = {
  id: string;
  ruleId: string;
  title: string;
  body: string;
  /** Rótulo do período a que diz respeito ("julho de 2026"). */
  periodLabel: string;
  /** Quando passou a estar em aberto. */
  dueAt: number;
  /** Cliente, quando a notificação é por cliente. */
  client: { slug: string; title: string; icon: string | null } | null;
  actionLabel: string;
  /** Já com o slug substituído. Vazio = notificação sem botão. */
  actionHref: string;
  resolved: boolean;
  resolvedAt: number | null;
};

type Viewer = { username: string; name: string; dept: string };

/** Clientes SEO da carteira desta pessoa. Um cliente em pausa sai da lista —
 *  pedir o relatório de uma conta suspensa é ruído, não é lembrete. */
async function seoBookOf(
  viewer: Viewer,
): Promise<{ slug: string; title: string; icon: string | null }[]> {
  let clients: { slug: string; title: string; icon: string | null }[] = [];
  try {
    const all = await getSeoClients();
    clients = all
      .filter((c) => getConsultantForSlug(c.slug) === viewer.name)
      .map((c) => ({ slug: c.slug, title: c.title, icon: c.icon }));
  } catch (err) {
    console.error("Notificações: getSeoClients falhou:", err);
    return [];
  }
  try {
    const paused = await getPausedSlugSet();
    clients = clients.filter((c) => !paused.has(c.slug));
  } catch {
    /* KV em baixo — mais vale a lista completa do que lista nenhuma */
  }
  return clients;
}

/** Notificações em aberto (e as recentemente resolvidas) de um utilizador. */
export async function getUserNotifications(
  viewer: Viewer,
  now: Date = new Date(),
): Promise<UserNotification[]> {
  const [rules, state] = await Promise.all([
    getNotificationRules(),
    getNotificationState(viewer.username),
  ]);

  const applicable = rules.filter(
    (r) => r.enabled && audienceMatches(r.audience, viewer),
  );
  if (applicable.length === 0) return [];

  // A carteira só se lê se alguma regra precisar dela.
  const needsBook = applicable.some((r) => r.scope === "seo-client");
  const book = needsBook ? await seoBookOf(viewer) : [];

  const out: UserNotification[] = [];
  for (const rule of applicable) {
    for (const occ of occurrencesFor(rule, now)) {
      const targets: (UserNotification["client"] | null)[] =
        rule.scope === "seo-client" ? book : [null];
      for (const client of targets) {
        const id = notificationId(rule.id, occ.periodKey, client?.slug ?? "-");
        const entry = state[id];
        out.push({
          id,
          ruleId: rule.id,
          title: rule.title,
          body: rule.body,
          periodLabel: occ.periodLabel,
          dueAt: occ.dueAt,
          client,
          actionLabel: rule.actionLabel,
          actionHref: resolveHref(rule.actionHref, client?.slug ?? null),
          resolved: Boolean(entry),
          resolvedAt: entry?.resolvedAt ?? null,
        });
      }
    }
  }

  // Por resolver primeiro, e dentro disso o mais antigo à cabeça: o relatório
  // do mês passado que ficou por enviar é mais urgente do que o deste mês.
  return out.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    if (a.dueAt !== b.dueAt) return a.resolved ? b.dueAt - a.dueAt : a.dueAt - b.dueAt;
    return (a.client?.title ?? "").localeCompare(b.client?.title ?? "", "pt");
  });
}

/** True quando este id é mesmo uma notificação em vigor para este utilizador.
 *  Sem esta verificação, um POST forjado escrevia chaves arbitrárias no
 *  estado de qualquer pessoa. */
export async function notificationExistsForUser(
  viewer: Viewer,
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  const list = await getUserNotifications(viewer, now);
  return list.some((n) => n.id === id);
}

/** Só para o painel do Superadmin: quantas pessoas uma regra abrange. */
export function ruleAudienceLabel(rule: NotificationRule): string {
  switch (rule.audience.kind) {
    case "all":
      return "Toda a equipa";
    case "dept":
      return rule.audience.dept === "All"
        ? "Toda a equipa"
        : `Departamento ${rule.audience.dept}`;
    case "users":
      return rule.audience.usernames.length === 0
        ? "Ninguém (lista vazia)"
        : rule.audience.usernames.join(", ");
  }
}
