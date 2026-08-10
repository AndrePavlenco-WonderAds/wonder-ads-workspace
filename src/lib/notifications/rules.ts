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
 *  • `once` — a partir de uma data concreta (ISO yyyy-mm-dd).
 *  • `client-month` — na ÚLTIMA SEMANA do mês N de acompanhamento de cada
 *    cliente. Não é o calendário que manda, é a idade do contrato: dois
 *    clientes do mesmo consultor disparam em semanas diferentes.
 *  • `weekly` — todas as semanas, no dia da semana N (0 = domingo, 5 =
 *    sexta). O período é a SEMANA, não o mês: o lembrete de sexta-feira
 *    passada e o desta sexta são coisas diferentes e resolvem-se à parte —
 *    se partilhassem período, despachar um apagava o outro. */
export type NotificationSchedule =
  | { kind: "monthly"; dayOfMonth: number }
  | { kind: "once"; date: string }
  | { kind: "client-month"; months: number[] }
  | { kind: "weekly"; weekday: number };

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

/** Quantos períodos passados continuam a aparecer. Um: o relatório do mês
 *  passado que ficou por enviar tem de continuar à frente dos olhos este mês
 *  — mas uma lista com meio ano de atrasos deixa de se ler. */
export const LOOKBACK_PERIODS = 1;

/** Semanas para trás nas regras `weekly`. Duas: dá para recuperar a sexta
 *  passada sem transformar o sino num arquivo de meio ano de lembretes que
 *  já não têm o que resolver. */
export const WEEKLY_LOOKBACK_WEEKS = 2;

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
    // Data de entrada em vigor, não decorativa: nenhuma ocorrência é gerada
    // antes do mês em que a regra passou a existir. Sem isto, no primeiro dia
    // a app acusava toda a gente de meses de relatórios em atraso que nunca
    // lhes foram pedidos — e a primeira coisa que se aprende sobre o sino
    // seria a despachá-lo em bloco.
    createdAt: new Date(2026, 7, 1).getTime(), // 01/08/2026
    createdBy: "sistema",
  },
  {
    id: "seo-nps-survey",
    title: "Enviar NPS Score Form ao cliente",
    body: "Última semana do mês de acompanhamento — pede a avaliação antes de o mês fechar. A página do NPS copia o link e escreve o email por ti.",
    audience: { kind: "dept", dept: "SEO" },
    scope: "seo-client",
    // Meses 3 a 6: cedo demais e ainda não há resultados para avaliar; tarde
    // demais e a renovação já foi decidida sem se saber o que o cliente acha.
    schedule: { kind: "client-month", months: [3, 4, 5, 6] },
    actionLabel: "Abrir NPS do cliente",
    actionHref: "/seo/{slug}/nps",
    enabled: true,
    // Mesma razão do relatório mensal: sem chão, no dia do deploy toda a
    // gente levava com quatro NPS «em atraso» de janelas que passaram antes
    // de a regra existir.
    createdAt: new Date(2026, 7, 1).getTime(), // 01/08/2026
    createdBy: "sistema",
  },
  {
    id: "seo-weekly-reports",
    title: "Enviar os Weekly Reports nos grupos",
    body: "Sexta-feira: cola os daily updates da semana no estúdio e sai um ponto de situação por cliente, pronto a colar no grupo de WhatsApp de cada um.",
    audience: { kind: "dept", dept: "SEO" },
    // UMA por consultor, não uma por cliente. O weekly report faz-se numa
    // sentada, a partir dos daily updates da semana, e a página devolve a
    // carteira inteira de uma vez — dez linhas no sino para o mesmo trabalho
    // ensinariam a ignorá-lo.
    scope: "user",
    // Sexta-feira (0 = domingo). O ponto de situação fecha a semana; enviado
    // à segunda já está a falar de trabalho que o cliente considera velho.
    schedule: { kind: "weekly", weekday: 5 },
    actionLabel: "Abrir estúdio de Weekly Reports",
    actionHref: "/seo/weekly-reports",
    enabled: true,
    createdAt: new Date(2026, 7, 10).getTime(), // 10/08/2026
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
  // Nada antes do mês em que a regra passou a existir. Uma regra criada hoje
  // não pode reclamar trabalho de trás — ninguém foi avisado na altura.
  const floor = ruleFloor(rule);

  // O calendário não sabe responder por esta: a janela depende da data de
  // início de CADA cliente. Quem sabe é `clientMonthOccurrences`, chamada
  // pelo motor com a carteira já em mãos.
  if (rule.schedule.kind === "client-month") return [];

  if (rule.schedule.kind === "weekly") {
    const weekday = Math.min(6, Math.max(0, Math.round(rule.schedule.weekday)));
    const out: NotificationOccurrence[] = [];
    // Uma ocorrência por semana para trás, a começar na mais recente que já
    // passou. O lookback é em MESES nas outras regras; aqui contam-se
    // semanas, senão um lembrete semanal enchia o sino com meio ano.
    for (let back = 0; back <= WEEKLY_LOOKBACK_WEEKS; back += 1) {
      const anchor = new Date(now);
      anchor.setHours(9, 0, 0, 0);
      const diff = (anchor.getDay() - weekday + 7) % 7;
      anchor.setDate(anchor.getDate() - diff - back * 7);
      if (anchor.getTime() > now.getTime()) continue;
      if (anchor.getTime() < floor) continue;
      const y = anchor.getFullYear();
      const m = String(anchor.getMonth() + 1).padStart(2, "0");
      const d = String(anchor.getDate()).padStart(2, "0");
      out.push({
        periodKey: `${y}-${m}-${d}`,
        dueAt: anchor.getTime(),
        periodLabel: `semana de ${d}/${m}`,
      });
    }
    return out;
  }

  if (rule.schedule.kind === "once") {
    const at = new Date(`${rule.schedule.date}T09:00:00`);
    if (Number.isNaN(at.getTime()) || at.getTime() > now.getTime()) return [];
    if (at.getTime() < floor) return [];
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
    if (anchor.getTime() < floor) continue; // anterior à regra
    out.push({
      periodKey: monthKey(anchor),
      dueAt: anchor.getTime(),
      periodLabel: referenceMonthLabel(anchor.getFullYear(), anchor.getMonth()),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Janelas ancoradas no contrato do cliente (`client-month`)
// ---------------------------------------------------------------------------

/** Quanto tempo uma janela destas continua à vista depois de abrir.
 *
 *  A janela em si dura 7 dias, mas desaparecer ao oitavo transformava um NPS
 *  esquecido numa coisa que nunca aconteceu. Cinco semanas é o mesmo espírito
 *  do `LOOKBACK_PERIODS` dos mensais: dá para recuperar o mês seguinte e
 *  depois cala-se, em vez de arrastar meio ano de dívida que ninguém lê. */
export const CLIENT_MONTH_VISIBILITY_DAYS = 35;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mês em que a regra passou a existir — nada é reclamado antes disto. */
function ruleFloor(rule: NotificationRule): number {
  if (!rule.createdAt) return 0;
  const c = new Date(rule.createdAt);
  return new Date(c.getFullYear(), c.getMonth(), 1).getTime();
}

/** `base` + n meses, com o dia preso ao último dia do mês de destino (31/01
 *  + 1 mês = 28/02, não 03/03). Sem isto, os clientes que entram a 29, 30 ou
 *  31 saltavam a janela para o mês seguinte. */
function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(base.getDate(), lastDay));
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Ocorrências de uma regra `client-month` para UM cliente.
 *
 *  O mês N de acompanhamento vai de `início + (N-1) meses` a `início + N
 *  meses`; a última semana são os 7 dias antes de fechar. A notificação abre
 *  quando essa semana começa — nunca antes, porque pedir a avaliação do mês 3
 *  no dia 1 do mês 3 é pedi-la sobre trabalho que ainda não foi feito. */
export function clientMonthOccurrences(
  rule: NotificationRule,
  clientStartedAt: string | null,
  now: Date,
): NotificationOccurrence[] {
  if (rule.schedule.kind !== "client-month") return [];
  if (!clientStartedAt || !/^\d{4}-\d{2}-\d{2}$/.test(clientStartedAt)) {
    // Sem data de início não há relógio. Melhor não notificar do que
    // notificar na altura errada.
    return [];
  }
  const start = new Date(`${clientStartedAt}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  const floor = ruleFloor(rule);
  const nowMs = now.getTime();
  const out: NotificationOccurrence[] = [];

  for (const month of rule.schedule.months) {
    const n = Math.round(month);
    if (!Number.isFinite(n) || n < 1) continue;
    const monthEnd = addMonths(start, n);
    const windowStart = monthEnd.getTime() - 7 * DAY_MS;
    if (windowStart > nowMs) continue; // ainda não chegou a última semana
    if (windowStart < floor) continue; // janela anterior à própria regra
    if (nowMs - windowStart > CLIENT_MONTH_VISIBILITY_DAYS * DAY_MS) continue;
    out.push({
      periodKey: `m${n}`,
      dueAt: windowStart,
      periodLabel: `mês ${n} de acompanhamento`,
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
  if (o.kind === "weekly") {
    // Sem isto, uma regra semanal gravada pelo painel voltava de KV
    // convertida em mensal — silenciosamente, e só se descobria quando o
    // lembrete de sexta deixasse de aparecer.
    const weekday =
      typeof o.weekday === "number" && Number.isFinite(o.weekday)
        ? Math.min(6, Math.max(0, Math.round(o.weekday)))
        : 5;
    return { kind: "weekly", weekday };
  }
  if (o.kind === "client-month") {
    const months = Array.from(
      new Set(
        (Array.isArray(o.months) ? o.months : [])
          .map((m) => (typeof m === "number" ? Math.round(m) : Number.NaN))
          .filter((m) => Number.isFinite(m) && m >= 1 && m <= 36),
      ),
    ).sort((a, b) => a - b);
    // Uma lista vazia é uma regra que nunca dispara — em vez de a deixar
    // passar em silêncio, cai no default que motivou a funcionalidade.
    return { kind: "client-month", months: months.length ? months : [3, 4, 5, 6] };
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
