// Regras de notificação — módulo PURO (sem KV, sem React, sem Notion).
//
// DESENHO — AS NOTIFICAÇÕES NÃO SÃO GRAVADAS, SÃO DERIVADAS.
//
// Uma alternativa seria um cron que, no dia 2, escreve N notificações em KV
// (uma por consultor × cliente) e a app lê-as. Recusámos por três razões:
//
//  1. Um cron que falha uma vez perde o mês inteiro — e ninguém dá por isso,
//     porque a ausência de uma notificação não dispara nada.
//  2. Adicionar um cliente a meio do mês exigiria reprocessar o passado.
//  3. Escrever ~50 chaves por mês para depois as ler todas é trabalho a mais
//     para uma informação que se calcula em memória a partir do calendário.
//
// Aqui a regra + a data de hoje + a carteira do consultor DÃO a lista. A única
// coisa que se escreve em KV é o que o utilizador fez (marcou como concluída),
// porque isso é a única coisa que não se consegue derivar.
//
// Consequência importante: uma notificação tem de ter um id ESTÁVEL, gerado
// deterministicamente a partir de (regra, período, alvo). É esse id que o
// estado "concluída" referencia — e é por isso que ele não pode depender da
// ordem de leitura nem de nada aleatório.

/** Quem recebe a notificação. */
export type NotificationAudience =
  | { kind: "all" }
  | { kind: "dept"; dept: string }
  | { kind: "users"; usernames: string[] };

/** Sobre o quê é a notificação.
 *  • `user` — uma notificação por pessoa.
 *  • `seo-client` — uma por pessoa × cliente SEO da carteira dela. */
export const NOTIFICATION_SCOPES = ["user", "seo-client"] as const;
export type NotificationScope = (typeof NOTIFICATION_SCOPES)[number];

/** Quando aparece.
 *  • `monthly` — no dia N de cada mês.
 *  • `once` — a partir de uma data concreta (ISO yyyy-mm-dd). */
export type NotificationSchedule =
  | { kind: "monthly"; dayOfMonth: number }
  | { kind: "once"; date: string };

export type NotificationRule = {
  id: string;
  title: string;
  /** Frase de contexto por baixo do título. */
  body: string;
  audience: NotificationAudience;
  scope: NotificationScope;
  schedule: NotificationSchedule;
  /** Texto do botão de ação. */
  actionLabel: string;
  /** Destino do botão. `{slug}` é substituído pelo slug do cliente quando o
   *  scope é `seo-client`. Vazio = notificação sem botão de ação. */
  actionHref: string;
  enabled: boolean;
  createdAt: number;
  createdBy: string;
};

/** Quantos períodos passados continuam a aparecer. Dois meses: o relatório de
 *  julho que ninguém enviou tem de continuar à frente dos olhos em agosto —
 *  mas não até ao fim do ano. */
export const LOOKBACK_PERIODS = 2;

export const DEPT_OPTIONS = ["SEO", "ADS", "Web", "Commercial", "All"] as const;

/** A regra que existe desde o dia 1 e que motivou a funcionalidade: no dia 2
 *  de cada mês, cada consultor de SEO tem de enviar o relatório mensal de cada
 *  cliente da sua carteira. Vive em código para que uma instalação limpa (ou
 *  um KV vazio) já a tenha; o Superadmin pode desativá-la ou editá-la. */
export const DEFAULT_NOTIFICATION_RULES: NotificationRule[] = [
  {
    id: "seo-monthly-report",
    title: "Enviar Monthly Report",
    body: "O relatório do mês fechado tem de sair nos primeiros dias do mês seguinte. Um por cliente da tua carteira.",
    audience: { kind: "dept", dept: "SEO" },
    scope: "seo-client",
    schedule: { kind: "monthly", dayOfMonth: 2 },
    actionLabel: "Abrir Monthly Report",
    actionHref: "/seo/{slug}/report",
    enabled: true,
    createdAt: 0,
    createdBy: "sistema",
  },
];

// ---------------------------------------------------------------------------
// Períodos
// ---------------------------------------------------------------------------

export type NotificationOccurrence = {
  /** "2026-08" para mensais, "2026-08-02" para pontuais. Entra no id. */
  periodKey: string;
  /** Quando a notificação passou a existir (é também a data que se mostra). */
  dueAt: number;
  /** Rótulo humano do período — "agosto de 2026". */
  periodLabel: string;
};

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** O mês a que o trabalho diz respeito — para uma regra que dispara no dia 2
 *  de agosto, o relatório é o de JULHO. Dizer "relatório de agosto" no dia 2
 *  de agosto seria pedir um mês que ainda nem começou a fechar. */
function referenceMonthLabel(year: number, month: number): string {
  const prev = new Date(year, month - 1, 1);
  return `${MONTHS_PT[prev.getMonth()]} de ${prev.getFullYear()}`;
}

/** Ocorrências ativas de uma regra à data de `now`, da mais recente para a
 *  mais antiga. Uma ocorrência mensal só existe depois de o dia N ter chegado
 *  — no dia 1 ninguém é avisado de nada. */
export function occurrencesFor(
  rule: NotificationRule,
  now: Date,
  lookback: number = LOOKBACK_PERIODS,
): NotificationOccurrence[] {
  if (rule.schedule.kind === "once") {
    const at = new Date(`${rule.schedule.date}T09:00:00`);
    if (Number.isNaN(at.getTime()) || at.getTime() > now.getTime()) return [];
    return [
      {
        periodKey: rule.schedule.date,
        dueAt: at.getTime(),
        periodLabel: rule.schedule.date,
      },
    ];
  }

  const day = Math.min(28, Math.max(1, Math.round(rule.schedule.dayOfMonth)));
  const out: NotificationOccurrence[] = [];
  for (let back = 0; back <= lookback; back += 1) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - back, day);
    if (anchor.getTime() > now.getTime()) continue; // ainda não chegou o dia
    out.push({
      periodKey: monthKey(anchor),
      dueAt: anchor.getTime(),
      periodLabel: referenceMonthLabel(anchor.getFullYear(), anchor.getMonth()),
    });
  }
  return out;
}

/** Id determinístico. É a chave por onde o "concluído" é guardado — mudar este
 *  formato faz reaparecer tudo o que já tinha sido resolvido. */
export function notificationId(
  ruleId: string,
  periodKey: string,
  targetKey: string,
): string {
  return `${ruleId}|${periodKey}|${targetKey}`;
}

/** A regra aplica-se a esta pessoa? */
export function audienceMatches(
  audience: NotificationAudience,
  user: { username: string; dept: string },
): boolean {
  switch (audience.kind) {
    case "all":
      return true;
    case "dept":
      return audience.dept === "All" || user.dept === audience.dept;
    case "users":
      return audience.usernames.includes(user.username);
  }
}

/** `/seo/{slug}/report` + "b-life" → `/seo/b-life/report`. */
export function resolveHref(template: string, slug: string | null): string {
  if (!template) return "";
  return template.replace(/\{slug\}/g, slug ?? "");
}

// ---------------------------------------------------------------------------
// Normalização — o override de KV nunca é confiado às cegas (mesmo padrão do
// catálogo da Formação: uma regra inválida é descartada, não rebenta a app).
// ---------------------------------------------------------------------------

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

function normalizeAudience(raw: unknown): NotificationAudience {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  if (o.kind === "users") {
    const usernames = (Array.isArray(o.usernames) ? o.usernames : [])
      .map((u) => str(u).trim())
      .filter(Boolean);
    return { kind: "users", usernames };
  }
  if (o.kind === "dept") {
    return { kind: "dept", dept: str(o.dept, "SEO") };
  }
  return { kind: "all" };
}

function normalizeSchedule(raw: unknown): NotificationSchedule {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  if (o.kind === "once" && /^\d{4}-\d{2}-\d{2}$/.test(str(o.date))) {
    return { kind: "once", date: str(o.date) };
  }
  const day =
    typeof o.dayOfMonth === "number" && Number.isFinite(o.dayOfMonth)
      ? Math.min(28, Math.max(1, Math.round(o.dayOfMonth)))
      : 1;
  return { kind: "monthly", dayOfMonth: day };
}

export function normalizeRule(raw: unknown, i: number): NotificationRule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = str(o.title).trim();
  if (!title) return null;
  const scope = (NOTIFICATION_SCOPES as readonly string[]).includes(
    str(o.scope),
  )
    ? (o.scope as NotificationScope)
    : "user";
  return {
    id: str(o.id).trim() || `rule-${i + 1}`,
    title,
    body: str(o.body),
    audience: normalizeAudience(o.audience),
    scope,
    schedule: normalizeSchedule(o.schedule),
    actionLabel: str(o.actionLabel).trim() || "Abrir",
    actionHref: str(o.actionHref).trim(),
    enabled: typeof o.enabled === "boolean" ? o.enabled : true,
    createdAt:
      typeof o.createdAt === "number" && Number.isFinite(o.createdAt)
        ? o.createdAt
        : 0,
    createdBy: str(o.createdBy, "—"),
  };
}

/** Lista de regras vinda de KV. Devolve null quando é inutilizável — o
 *  chamador cai para os defaults do código. Ids repetidos são recusados: dois
 *  ids iguais fariam duas regras partilhar o mesmo estado de "concluída". */
export function normalizeRules(raw: unknown): NotificationRule[] | null {
  if (!Array.isArray(raw)) return null;
  const rules = raw
    .map(normalizeRule)
    .filter((r): r is NotificationRule => r !== null);
  const seen = new Set<string>();
  for (const r of rules) {
    if (seen.has(r.id)) return null;
    seen.add(r.id);
  }
  return rules;
}
