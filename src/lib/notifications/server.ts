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
import { EMPLOYEE_CREDENTIALS } from "@/lib/auth/credentials";
import { getNotificationRules } from "@/lib/notifications/rules-store";
import {
  getNotificationState,
  getNotificationStateMany,
  type NotificationState,
} from "@/lib/notifications/state-store";
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

type ClientRef = { slug: string; title: string; icon: string | null };

/** Toda a carteira SEO indexada por consultor, numa leitura só. Clientes em
 *  pausa saem — pedir o relatório de uma conta suspensa é ruído, não é
 *  lembrete. O consultor é RE-RESOLVIDO a partir do slug e nunca do campo
 *  em cache (ver o cabeçalho do ficheiro). */
async function seoBooksByConsultant(): Promise<Map<string, ClientRef[]>> {
  const out = new Map<string, ClientRef[]>();
  let all: Awaited<ReturnType<typeof getSeoClients>>;
  try {
    all = await getSeoClients();
  } catch (err) {
    console.error("Notificações: getSeoClients falhou:", err);
    return out;
  }
  let paused = new Set<string>();
  try {
    paused = await getPausedSlugSet();
  } catch {
    /* KV em baixo — mais vale a lista completa do que lista nenhuma */
  }
  for (const c of all) {
    if (paused.has(c.slug)) continue;
    const consultant = getConsultantForSlug(c.slug);
    if (!consultant) continue;
    const list = out.get(consultant) ?? [];
    list.push({ slug: c.slug, title: c.title, icon: c.icon });
    out.set(consultant, list);
  }
  return out;
}

/** O cálculo em si — sem I/O, para poder ser corrido uma vez por pessoa a
 *  partir de leituras já feitas. É esta função que garante que o sino de um
 *  consultor e o painel de equipa do C-Level nunca divergem: é a mesma. */
function buildNotifications(
  viewer: Viewer,
  rules: NotificationRule[],
  state: NotificationState,
  book: ClientRef[],
  now: Date,
): UserNotification[] {
  const applicable = rules.filter(
    (r) => r.enabled && audienceMatches(r.audience, viewer),
  );
  if (applicable.length === 0) return [];

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
  const book = needsBook
    ? ((await seoBooksByConsultant()).get(viewer.name) ?? [])
    : [];

  return buildNotifications(viewer, rules, state, book, now);
}

// ---------------------------------------------------------------------------
// Painel de equipa — só para quem tem `isAdmin`
// ---------------------------------------------------------------------------

/** Quantas linhas em aberto de cada pessoa se mandam para o cliente. O painel
 *  é para SABER QUEM ESTÁ EM DÍVIDA, não para o C-Level despachar o trabalho
 *  dos outros — sem teto, um consultor com 30 clientes enchia o payload do
 *  header de toda a gente. */
const TEAM_ITEMS_PER_PERSON = 8;

export type TeamNotificationRow = {
  username: string;
  name: string;
  role: string;
  dept: string;
  pending: number;
  resolved: number;
  /** Quando é que a coisa mais antiga em aberto passou a estar em aberto. */
  oldestDueAt: number | null;
  /** Agrupado por lembrete + período, como no painel do próprio. */
  groups: { key: string; title: string; periodLabel: string; count: number }[];
  /** Amostra das linhas em aberto (ver TEAM_ITEMS_PER_PERSON). */
  items: { id: string; label: string; periodLabel: string; icon: string | null }[];
  /** Verdadeiro quando há mais do que os que vão em `items`. */
  truncated: number;
};

export type TeamNotificationSummary = {
  rows: TeamNotificationRow[];
  totalPending: number;
  peopleWithPending: number;
};

/** Fotografia das notificações de TODA a equipa — o que o Superadmin vê no
 *  seu painel lateral, por baixo das dele.
 *
 *  Uma leitura de regras, uma da carteira SEO inteira e UM `mget` para os
 *  estados de toda a gente. O custo é praticamente o mesmo de calcular só as
 *  do próprio. */
export async function getTeamNotificationSummary(
  now: Date = new Date(),
): Promise<TeamNotificationSummary> {
  const people = EMPLOYEE_CREDENTIALS.map((c) => ({
    username: c.username,
    name: c.name,
    role: c.role,
    dept: c.dept,
  }));

  const rules = await getNotificationRules();
  const enabled = rules.filter((r) => r.enabled);
  if (enabled.length === 0) {
    return { rows: [], totalPending: 0, peopleWithPending: 0 };
  }

  const needsBook = enabled.some((r) => r.scope === "seo-client");
  const [states, books] = await Promise.all([
    getNotificationStateMany(people.map((p) => p.username)),
    needsBook
      ? seoBooksByConsultant()
      : Promise.resolve(new Map<string, ClientRef[]>()),
  ]);

  const rows: TeamNotificationRow[] = [];
  for (const person of people) {
    const list = buildNotifications(
      person,
      rules,
      states[person.username] ?? {},
      books.get(person.name) ?? [],
      now,
    );
    if (list.length === 0) continue;

    const pending = list.filter((n) => !n.resolved);
    const groups = new Map<
      string,
      { key: string; title: string; periodLabel: string; count: number }
    >();
    for (const n of pending) {
      const key = `${n.ruleId}|${n.periodLabel}`;
      const g = groups.get(key);
      if (g) g.count += 1;
      else
        groups.set(key, {
          key,
          title: n.title,
          periodLabel: n.periodLabel,
          count: 1,
        });
    }

    rows.push({
      ...person,
      pending: pending.length,
      resolved: list.length - pending.length,
      oldestDueAt: pending.length
        ? Math.min(...pending.map((n) => n.dueAt))
        : null,
      groups: Array.from(groups.values()),
      items: pending.slice(0, TEAM_ITEMS_PER_PERSON).map((n) => ({
        id: n.id,
        label: n.client ? n.client.title : n.title,
        periodLabel: n.periodLabel,
        icon: n.client?.icon ?? null,
      })),
      truncated: Math.max(0, pending.length - TEAM_ITEMS_PER_PERSON),
    });
  }

  // Quem tem mais por resolver à cabeça; entre iguais, o atraso mais antigo.
  rows.sort(
    (a, b) =>
      b.pending - a.pending ||
      (a.oldestDueAt ?? Infinity) - (b.oldestDueAt ?? Infinity) ||
      a.name.localeCompare(b.name, "pt"),
  );

  return {
    rows,
    totalPending: rows.reduce((s, r) => s + r.pending, 0),
    peopleWithPending: rows.filter((r) => r.pending > 0).length,
  };
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
