// Ineficácias — o que é partilhado entre o browser e o servidor: os tipos,
// os catálogos (motivos, quem deu pelo erro, a escala 0–10), as semanas ISO,
// a validação do relatório e a DERIVAÇÃO do estado de cada consultor (PA,
// NO, nível, medida por aplicar). Puro: sem KV, sem relógio — o «hoje» entra
// sempre por parâmetro, como no probation.
//
// AS REGRAS (slides «As ineficácias — o que conta e quanto vale» + a resposta
// da Beatriz no Slack, 2026-09-30):
//   • Cada ocorrência vale de 0 a 10 pontos, dados pela DIREÇÃO depois de o
//     consultor a reportar. Só uma ocorrência pontuada (> 0) entra nas contas.
//   • PA = soma dos pontos · NO = número de ocorrências, numa JANELA DE 30
//     DIAS.
//   • Nível 1: PA ≥ 6 ou NO ≥ 3 → 1:1 com o líder direto, plano de 1 a 3 ações.
//     Nível 2 (depois do 1): PA ≥ 6 ou NO ≥ 2 → 1:1 com o nível acima.
//     Nível 3 (depois do 2): PA ≥ 6 ou NO ≥ 2 → probation.
//   • «Sempre que uma reunião de Nível (1:1) é realizada, os contadores (PA e
//     NO) reiniciam a zero para a fase seguinte. Contudo, a progressão de
//     níveis é linear e cumulativa.» E «reinicia mas não se apagam as
//     ineficácias» — o histórico fica.
//   • Uma falha grave sozinha pode levar a probation direto — a direção pode
//     definir o nível à mão, com justificação.

/* ------------------------------------------------------------------ */
/*  Catálogos                                                          */
/* ------------------------------------------------------------------ */

export type IneficaciaReason = "atencao" | "protocolo" | "tempo" | "outro";

export const REASONS: { id: IneficaciaReason; letter: string; label: string; hint: string }[] = [
  { id: "atencao", letter: "A", label: "Falta de atenção", hint: "Sabia como fazer, mas falhou na execução." },
  { id: "protocolo", letter: "B", label: "Falta de protocolo documentado", hint: "Não havia processo escrito para seguir." },
  { id: "tempo", letter: "C", label: "Falta de tempo", hint: "Não houve margem para fazer bem." },
  { id: "outro", letter: "D", label: "Outro", hint: "Especifica o motivo." },
];

export function reasonLabel(id: IneficaciaReason, other?: string): string {
  if (id === "outro" && other?.trim()) return `Outro — ${other.trim()}`;
  return REASONS.find((r) => r.id === id)?.label ?? id;
}

/** Quem deu pelo erro — pesa na pontuação (um erro visível para o cliente
 *  está na banda alta da escala). */
export type IneficaciaNoticed = "proprio" | "equipa" | "cliente";

export const NOTICED_OPTIONS: { id: IneficaciaNoticed; label: string; read: string; hint: string }[] = [
  {
    id: "proprio",
    label: "Sim, apercebi-me por iniciativa própria",
    read: "Apercebeu-se por iniciativa própria",
    hint: "Detetei o erro e corrigi-o (ou reportei-o) sem ninguém mo apontar.",
  },
  {
    id: "equipa",
    label: "Não — foi um colega ou líder que o apontou",
    read: "Apontado por um colega ou líder",
    hint: "Só percebi quando alguém da equipa o viu.",
  },
  {
    id: "cliente",
    label: "Não — foi o cliente que o apontou",
    read: "Apontado pelo cliente",
    hint: "O erro chegou ao cliente antes de ser corrigido.",
  },
];

/** A forma de LEITURA (terceira pessoa) — para vistas, listas e o Slack. */
export function noticedLabel(id: IneficaciaNoticed): string {
  return NOTICED_OPTIONS.find((n) => n.id === id)?.read ?? id;
}

/** A escala de 0 a 10 — as bandas dos slides. 0 = não conta (a direção
 *  decidiu que não é uma ineficácia, ou não tem peso). */
export type ScoreBand = { min: number; max: number; id: "zero" | "baixo" | "medio" | "alto" | "critico"; label: string; hint: string };

export const SCORE_BANDS: ScoreBand[] = [
  { min: 0, max: 0, id: "zero", label: "Não conta", hint: "Sem peso — não entra no PA nem no NO." },
  { min: 1, max: 3, id: "baixo", label: "Baixo", hint: "Recuperável no próprio dia." },
  { min: 4, max: 6, id: "medio", label: "Médio", hint: "Alguém refaz trabalho." },
  { min: 7, max: 8, id: "alto", label: "Alto", hint: "Impacto direto no cliente ou na equipa." },
  { min: 9, max: 10, id: "critico", label: "Crítico", hint: "Risco real para o negócio." },
];

export function bandOf(points: number): ScoreBand {
  return SCORE_BANDS.find((b) => points >= b.min && points <= b.max) ?? SCORE_BANDS[0];
}

export const MAX_POINTS = 10;

/** Exemplos de ineficácias — dos slides, para o explicador. */
export const EXAMPLES = [
  "prazo não cumprido sem aviso",
  "trabalho devolvido para refazer mais do que 1x",
  "erro visível para o cliente",
  "processo não seguido",
  "report não enviado",
];

export type IneficaciaLevel = 0 | 1 | 2 | 3;

export const LEVELS: { level: IneficaciaLevel; title: string; rule: string; measure: string }[] = [
  { level: 0, title: "Nível 0", rule: "PA até 5 e NO até 2", measure: "Correção no momento, pelo líder direto." },
  { level: 1, title: "Nível 1", rule: "PA ≥ 6 ou NO ≥ 3", measure: "1:1 com o líder direto e plano de 1 a 3 ações." },
  { level: 2, title: "Nível 2", rule: "depois do 1: PA ≥ 6 ou NO ≥ 2", measure: "1:1 com o nível acima e medidas extra." },
  { level: 3, title: "Nível 3", rule: "depois do 2: PA ≥ 6 ou NO ≥ 2", measure: "Probation: plano escrito, KPIs e cadência." },
];

export const WINDOW_DAYS = 30;

/** O limiar para ATINGIR um nível (a partir do anterior). */
export function thresholdToReach(level: 1 | 2 | 3): { pa: number; no: number } {
  return { pa: 6, no: level === 1 ? 3 : 2 };
}

export const DECLARATION_TEXT =
  "Declaro que este relatório é completo e verdadeiro e que reportei todos os erros de que tenho conhecimento nesta semana.";

/* ------------------------------------------------------------------ */
/*  Tipos dos registos                                                 */
/* ------------------------------------------------------------------ */

/** Uma ocorrência tal como o consultor a escreve (antes de ir ao servidor). */
export type IneficaciaItemDraft = {
  /** O erro — o que aconteceu. */
  what: string;
  /** Em que cliente ou projeto («Interno» quando não há cliente). */
  client: string;
  reason: IneficaciaReason | null;
  reasonOther: string;
  /** Como acha que deveria ter feito. */
  shouldHave: string;
  /** Primeira vez que cometeu este erro? null = por responder. */
  firstTime: boolean | null;
  /** Quando foi a última vez (obrigatório quando não é a primeira). */
  lastTime: string;
  /** Data em que ocorreu — dentro da semana do relatório (YYYY-MM-DD). */
  occurredOn: string;
  /** Se percebeu o erro que cometeu. */
  noticed: IneficaciaNoticed | null;
};

export type IneficaciaScore = {
  /** 0–10. 0 = não conta. */
  points: number;
  by: string;
  byName: string;
  at: number;
  note: string;
};

export type IneficaciaItem = {
  id: string;
  what: string;
  client: string;
  reason: IneficaciaReason;
  reasonOther: string;
  shouldHave: string;
  firstTime: boolean;
  lastTime: string;
  occurredOn: string;
  noticed: IneficaciaNoticed;
  /** A pontuação da direção — null enquanto está por pontuar. */
  score: IneficaciaScore | null;
};

export type IneficaciaSignature = {
  /** O nome tal como foi escrito (validado contra a conta). */
  fullName: string;
  /** ISO 8601 em UTC. */
  signedAt: string;
  userId: string;
  ip: string;
  userAgent: string;
  /** SHA-256 (hex) do conteúdo canónico do relatório — ver canonicalContent. */
  hash: string;
};

export type IneficaciaReview = {
  by: string;
  byName: string;
  at: number;
  note: string;
};

export type IneficaciaReport = {
  id: string;
  /** Referência humana sequencial («INE-2026-007»). */
  ref: string;
  rev: number;
  username: string;
  name: string;
  role: string;
  dept: string;
  /** «2026-W42». */
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  items: IneficaciaItem[];
  /** O consultor declarou que não houve erros nesta semana. */
  noErrors: boolean;
  signature: IneficaciaSignature;
  createdAt: number;
  /** A revisão da direção — fica preenchida quando todas as ocorrências têm
   *  pontuação (ou quando um relatório sem erros é marcado como visto). */
  review: IneficaciaReview | null;
};

/** Uma ocorrência registada diretamente pela direção (não veio de um
 *  relatório do consultor). Nasce já pontuada. */
export type DirectOccurrence = {
  id: string;
  what: string;
  client: string;
  reason: IneficaciaReason;
  reasonOther: string;
  shouldHave: string;
  occurredOn: string;
  noticed: IneficaciaNoticed;
  score: IneficaciaScore;
  createdAt: number;
};

export type LedgerEvent =
  | {
      kind: "measure";
      id: string;
      /** O nível cuja medida foi aplicada (1 = 1:1 com o líder, 2 = 1:1 com o
       *  nível acima, 3 = probation iniciado). */
      level: 1 | 2 | 3;
      /** Data da reunião / do arranque (YYYY-MM-DD). */
      at: string;
      by: string;
      byName: string;
      /** Quem conduziu o 1:1. */
      conductedBy: string;
      /** As 1 a 3 ações combinadas (nível 1) ou as medidas extra (nível 2). */
      actions: string[];
      note: string;
      createdAt: number;
    }
  | {
      kind: "set-level";
      id: string;
      level: IneficaciaLevel;
      at: string;
      by: string;
      byName: string;
      note: string;
      createdAt: number;
    };

export type IneficaciaLedger = {
  username: string;
  events: LedgerEvent[];
  direct: DirectOccurrence[];
  updatedAt: number;
};

/** A vista unificada de uma ocorrência, venha do relatório ou da direção. */
export type Occurrence = {
  id: string;
  source: "report" | "direcao";
  reportId: string | null;
  reportRef: string | null;
  weekKey: string;
  occurredOn: string;
  what: string;
  client: string;
  reason: IneficaciaReason;
  reasonOther: string;
  shouldHave: string;
  firstTime: boolean | null;
  lastTime: string;
  noticed: IneficaciaNoticed;
  score: IneficaciaScore | null;
};

/* ------------------------------------------------------------------ */
/*  Datas e semanas ISO                                                */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

export function isISODate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function utcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  return fromMs(utcMs(iso) + days * DAY_MS);
}

/** Dias inteiros de `a` até `b` (negativo se `b` é antes). */
export function daysBetweenISO(a: string, b: string): number {
  return Math.round((utcMs(b) - utcMs(a)) / DAY_MS);
}

/** DD/MM/YYYY — o formato da casa. */
export function formatISODate(iso: string): string {
  if (!isISODate(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** DD/MM — para intervalos curtos. */
export function formatISODayMonth(iso: string): string {
  if (!isISODate(iso)) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** A segunda-feira da semana de `iso`. */
export function mondayOf(iso: string): string {
  const ms = utcMs(iso);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // 0 = segunda
  return fromMs(ms - dow * DAY_MS);
}

/** Semana ISO-8601 (a quinta-feira decide o ano). */
export function isoWeekOf(iso: string): { year: number; week: number } {
  const monday = utcMs(mondayOf(iso));
  const thursday = new Date(monday + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week1Monday = utcMs(mondayOf(fromMs(Date.UTC(year, 0, 4))));
  const week = Math.round((monday - week1Monday) / (7 * DAY_MS)) + 1;
  return { year, week };
}

/** «2026-W42». */
export function weekKeyOf(iso: string): string {
  const { year, week } = isoWeekOf(iso);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function isWeekKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-W\d{2}$/.test(v) && weekRange(v) !== null;
}

/** Segunda e domingo de uma semana ISO, ou null se a chave não existe. */
export function weekRange(weekKey: string): { start: string; end: string } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const week1Monday = utcMs(mondayOf(fromMs(Date.UTC(year, 0, 4))));
  const start = fromMs(week1Monday + (week - 1) * 7 * DAY_MS);
  // A semana 53 só existe nos anos em que a quinta-feira ainda cai nesse ano.
  if (isoWeekOf(start).year !== year) return null;
  return { start, end: addDaysISO(start, 6) };
}

/** «Semana 42 · 06/10 – 12/10/2026». */
export function weekLabel(weekKey: string): string {
  const r = weekRange(weekKey);
  if (!r) return weekKey;
  const n = Number(weekKey.slice(-2));
  return `Semana ${n} · ${formatISODayMonth(r.start)} – ${formatISODate(r.end)}`;
}

/** «Semana 42» — a forma curta. */
export function weekShort(weekKey: string): string {
  const r = weekRange(weekKey);
  if (!r) return weekKey;
  return `Semana ${Number(weekKey.slice(-2))}`;
}

/** A semana anterior. */
export function previousWeekKey(weekKey: string): string {
  const r = weekRange(weekKey);
  return r ? weekKeyOf(addDaysISO(r.start, -7)) : weekKey;
}

/** As semanas que um consultor pode reportar hoje: a anterior (para quem
 *  fecha a semana à segunda de manhã) e a corrente — mas esta só a partir de
 *  sexta-feira, porque um relatório assinado à segunda trancava a semana
 *  antes de ela acontecer. Mais atrás não — um relatório com quinze dias de
 *  atraso já não é «desta semana». `sinceISO` corta as semanas anteriores à
 *  abertura do módulo: ninguém devia relatório nenhum antes disso. */
export function reportableWeeks(todayISO: string, sinceISO: string | null = null): string[] {
  const current = weekKeyOf(todayISO);
  const dow = (new Date(utcMs(todayISO)).getUTCDay() + 6) % 7; // 0 = segunda
  const keys = dow >= 4 ? [previousWeekKey(current), current] : [previousWeekKey(current)];
  return keys.filter((k) => !sinceISO || (weekRange(k)?.end ?? "") >= sinceISO);
}

/* ------------------------------------------------------------------ */
/*  Validação                                                           */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  what: { min: 15, max: 2000 },
  client: { min: 2, max: 120 },
  reasonOther: { min: 3, max: 200 },
  shouldHave: { min: 15, max: 2000 },
  lastTime: { min: 3, max: 200 },
  note: { max: 1000 },
  action: { max: 300 },
  maxItems: 20,
} as const;

/** Compara nomes «exatamente como está registado na conta»: só se ignora o
 *  espaço a mais nas pontas e espaços duplicados — maiúsculas e acentos
 *  contam. */
export function normalizeName(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

export function nameMatches(typed: string, expected: string): boolean {
  return normalizeName(typed) === normalizeName(expected) && normalizeName(expected).length > 0;
}

/** O problema de uma ocorrência, ou null se está completa. `n` é o número
 *  humano (1-based) para a mensagem. */
export function validateItem(
  item: IneficaciaItemDraft,
  week: { start: string; end: string },
  todayISO: string,
  n: number,
): string | null {
  const tag = `Erro ${n}:`;
  if (item.what.trim().length < LIMITS.what.min) return `${tag} descreve o que aconteceu (pelo menos ${LIMITS.what.min} caracteres).`;
  if (item.what.length > LIMITS.what.max) return `${tag} a descrição é demasiado longa.`;
  if (item.client.trim().length < LIMITS.client.min) return `${tag} indica o cliente ou projeto (ou «Interno»).`;
  if (item.client.length > LIMITS.client.max) return `${tag} o cliente/projeto é demasiado longo.`;
  if (!item.reason) return `${tag} escolhe o motivo (A, B, C ou D).`;
  if (item.reason === "outro" && item.reasonOther.trim().length < LIMITS.reasonOther.min) return `${tag} especifica o motivo «Outro».`;
  if (item.reasonOther.length > LIMITS.reasonOther.max) return `${tag} o motivo «Outro» é demasiado longo.`;
  if (item.shouldHave.trim().length < LIMITS.shouldHave.min) return `${tag} explica como achas que deverias ter feito (pelo menos ${LIMITS.shouldHave.min} caracteres).`;
  if (item.shouldHave.length > LIMITS.shouldHave.max) return `${tag} a explicação é demasiado longa.`;
  if (item.firstTime === null) return `${tag} diz se foi a primeira vez que cometeste este erro.`;
  if (item.firstTime === false && item.lastTime.trim().length < LIMITS.lastTime.min) return `${tag} indica quando foi a última vez.`;
  if (item.lastTime.length > LIMITS.lastTime.max) return `${tag} o «quando foi a última vez» é demasiado longo.`;
  if (!isISODate(item.occurredOn)) return `${tag} indica a data em que ocorreu.`;
  if (item.occurredOn < week.start || item.occurredOn > week.end) return `${tag} a data tem de estar dentro da semana (${formatISODate(week.start)} a ${formatISODate(week.end)}).`;
  if (item.occurredOn > todayISO) return `${tag} a data não pode ser no futuro.`;
  if (!item.noticed) return `${tag} diz se percebeste o erro que cometeste.`;
  return null;
}

export type ReportDraft = {
  weekKey: string;
  noErrors: boolean;
  items: IneficaciaItemDraft[];
  declaration: boolean;
  signatureName: string;
};

/** O problema do relatório inteiro, ou null. `expectedName` é o nome
 *  completo registado na conta; `allowedWeeks` as semanas ainda por
 *  reportar. */
export function validateReport(
  draft: ReportDraft,
  ctx: { todayISO: string; expectedName: string; allowedWeeks: string[] },
): string | null {
  if (!isWeekKey(draft.weekKey)) return "Escolhe a semana do relatório.";
  if (!ctx.allowedWeeks.includes(draft.weekKey)) return "Essa semana já não pode ser reportada (ou já foi).";
  const week = weekRange(draft.weekKey)!;
  if (week.start > ctx.todayISO) return "Essa semana ainda não começou.";
  if (draft.noErrors && draft.items.length > 0) return "Marcaste «sem erros» mas há erros descritos — tira a marca ou apaga-os.";
  if (!draft.noErrors && draft.items.length === 0) return "Descreve pelo menos um erro, ou marca «Não cometi nenhum erro de que tenha conhecimento esta semana».";
  if (draft.items.length > LIMITS.maxItems) return `No máximo ${LIMITS.maxItems} erros por relatório.`;
  for (let i = 0; i < draft.items.length; i += 1) {
    const p = validateItem(draft.items[i], week, ctx.todayISO, i + 1);
    if (p) return p;
  }
  if (!draft.declaration) return "Confirma a declaração antes de assinar.";
  if (!nameMatches(draft.signatureName, ctx.expectedName)) {
    return `A assinatura tem de ser o teu nome completo exatamente como está na conta: «${ctx.expectedName}».`;
  }
  return null;
}

/** Converte um rascunho validado em ocorrências limpas (sem pontuação). */
export function cleanItems(items: IneficaciaItemDraft[], newId: () => string): IneficaciaItem[] {
  return items.map((it) => ({
    id: newId(),
    what: it.what.trim(),
    client: it.client.trim(),
    reason: it.reason ?? "outro",
    reasonOther: it.reason === "outro" ? it.reasonOther.trim() : "",
    shouldHave: it.shouldHave.trim(),
    firstTime: Boolean(it.firstTime),
    lastTime: it.firstTime === false ? it.lastTime.trim() : "",
    occurredOn: it.occurredOn,
    noticed: it.noticed ?? "proprio",
    score: null,
  }));
}

/* ------------------------------------------------------------------ */
/*  Conteúdo canónico (o que o hash SHA-256 cobre)                     */
/* ------------------------------------------------------------------ */

/** O conteúdo do relatório tal como o consultor o assinou — SEM as
 *  pontuações nem a revisão da direção, que chegam depois e não podem
 *  invalidar a assinatura. A ordem dos campos é fixa de propósito: o hash
 *  tem de ser reproduzível para verificar a integridade mais tarde. */
export function canonicalContent(r: {
  username: string;
  weekKey: string;
  noErrors: boolean;
  items: Pick<
    IneficaciaItem,
    "what" | "client" | "reason" | "reasonOther" | "shouldHave" | "firstTime" | "lastTime" | "occurredOn" | "noticed"
  >[];
  fullName: string;
}): string {
  return JSON.stringify({
    v: 1,
    username: r.username,
    weekKey: r.weekKey,
    noErrors: r.noErrors,
    declaration: DECLARATION_TEXT,
    fullName: normalizeName(r.fullName),
    items: r.items.map((it) => ({
      what: it.what,
      client: it.client,
      reason: it.reason,
      reasonOther: it.reasonOther,
      shouldHave: it.shouldHave,
      firstTime: it.firstTime,
      lastTime: it.lastTime,
      occurredOn: it.occurredOn,
      noticed: it.noticed,
    })),
  });
}

/* ------------------------------------------------------------------ */
/*  Ocorrências unificadas + derivação do estado                       */
/* ------------------------------------------------------------------ */

export function occurrencesOf(reports: IneficaciaReport[], ledger: IneficaciaLedger | null): Occurrence[] {
  const out: Occurrence[] = [];
  for (const r of reports) {
    for (const it of r.items) {
      out.push({
        id: it.id,
        source: "report",
        reportId: r.id,
        reportRef: r.ref,
        weekKey: r.weekKey,
        occurredOn: it.occurredOn,
        what: it.what,
        client: it.client,
        reason: it.reason,
        reasonOther: it.reasonOther,
        shouldHave: it.shouldHave,
        firstTime: it.firstTime,
        lastTime: it.lastTime,
        noticed: it.noticed,
        score: it.score,
      });
    }
  }
  for (const d of ledger?.direct ?? []) {
    out.push({
      id: d.id,
      source: "direcao",
      reportId: null,
      reportRef: null,
      weekKey: weekKeyOf(d.occurredOn),
      occurredOn: d.occurredOn,
      what: d.what,
      client: d.client,
      reason: d.reason,
      reasonOther: d.reasonOther,
      shouldHave: d.shouldHave,
      firstTime: null,
      lastTime: "",
      noticed: d.noticed,
      score: d.score,
    });
  }
  return out.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
}

/** Uma ocorrência conta quando a direção lhe deu peso (> 0). */
export function counts(o: Occurrence): boolean {
  return Boolean(o.score && o.score.points > 0);
}

export type PendingMeasure = {
  /** O nível atingido cuja medida está por aplicar. */
  level: 1 | 2 | 3;
  /** A data da ocorrência que fez passar o limiar. */
  since: string;
  /** O PA e o NO no momento em que passou. */
  pa: number;
  no: number;
};

export type LedgerState = {
  /** O nível em que a pessoa ESTÁ (o último evento da direção, ou 0). */
  level: IneficaciaLevel;
  /** O nível ATINGIDO: igual a `level`, ou `level + 1` quando o limiar foi
   *  passado nesta fase e a medida ainda não foi registada. */
  reached: IneficaciaLevel;
  pendingMeasure: PendingMeasure | null;
  /** O evento que abriu a fase corrente (null = desde sempre). */
  phaseEvent: LedgerEvent | null;
  /** A partir de que dia as ocorrências contam na fase corrente. */
  phaseStart: string | null;
  /** A janela corrente: [windowStart, today]. */
  windowStart: string;
  /** PA e NO na janela corrente (só ocorrências pontuadas > 0). */
  pa: number;
  no: number;
  /** Ocorrências da fase por pontuar — ainda fora das contas. */
  unscored: number;
  /** O limiar do próximo nível (null quando já está no 3). */
  next: { level: 1 | 2 | 3; pa: number; no: number } | null;
  /** As ocorrências que contam na janela corrente. */
  counted: Occurrence[];
};

function eventOrder(a: LedgerEvent, b: LedgerEvent): number {
  return a.at.localeCompare(b.at) || a.createdAt - b.createdAt;
}

function levelAfter(e: LedgerEvent): IneficaciaLevel {
  return e.level;
}

/** PA/NO das ocorrências com `occurredOn` em (from, to]. */
function tally(occ: Occurrence[], fromExclusive: string | null, toInclusive: string): { pa: number; no: number; list: Occurrence[] } {
  const list = occ.filter(
    (o) => counts(o) && (fromExclusive === null || o.occurredOn > fromExclusive) && o.occurredOn <= toInclusive,
  );
  return { pa: list.reduce((s, o) => s + (o.score?.points ?? 0), 0), no: list.length, list };
}

/** O estado de um consultor hoje. */
export function deriveLedger(occurrences: Occurrence[], events: LedgerEvent[], todayISO: string): LedgerState {
  const sorted = events.slice().sort(eventOrder).filter((e) => e.at <= todayISO);
  const phaseEvent = sorted.at(-1) ?? null;
  const level: IneficaciaLevel = phaseEvent ? levelAfter(phaseEvent) : 0;
  // As ocorrências DO DIA da reunião ficam na fase anterior: a fase nova
  // começa no dia seguinte.
  const phaseStart = phaseEvent ? addDaysISO(phaseEvent.at, 1) : null;
  const phaseFrom = phaseEvent ? phaseEvent.at : null; // exclusivo
  const windowFloor = addDaysISO(todayISO, -(WINDOW_DAYS - 1));
  const windowStart = phaseStart && phaseStart > windowFloor ? phaseStart : windowFloor;

  const inPhase = occurrences
    .filter((o) => (phaseFrom === null || o.occurredOn > phaseFrom) && o.occurredOn <= todayISO)
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

  const current = tally(inPhase, addDaysISO(windowStart, -1), todayISO);
  const unscored = inPhase.filter((o) => !o.score).length;

  const nextLevel = level < 3 ? ((level + 1) as 1 | 2 | 3) : null;
  const next = nextLevel ? { level: nextLevel, ...thresholdToReach(nextLevel) } : null;

  // O limiar é «pegajoso»: passou numa janela de 30 dias em qualquer momento
  // da fase → a medida fica por aplicar até ser registada, mesmo que as
  // ocorrências entretanto saiam da janela corrente.
  let pendingMeasure: PendingMeasure | null = null;
  if (next) {
    for (const o of inPhase) {
      if (!counts(o)) continue;
      const w = tally(inPhase, addDaysISO(o.occurredOn, -WINDOW_DAYS), o.occurredOn);
      if (w.pa >= next.pa || w.no >= next.no) {
        pendingMeasure = { level: next.level, since: o.occurredOn, pa: w.pa, no: w.no };
        break;
      }
    }
  }

  return {
    level,
    reached: pendingMeasure ? pendingMeasure.level : level,
    pendingMeasure,
    phaseEvent,
    phaseStart,
    windowStart,
    pa: current.pa,
    no: current.no,
    unscored,
    next,
    counted: current.list.slice().sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
  };
}

/** As semanas em falta de um consultor, da mais recente para a mais antiga,
 *  olhando `lookback` semanas para trás (a corrente conta só a partir de
 *  sexta-feira — antes disso ainda está a decorrer). */
export function missingWeeks(
  reportedWeekKeys: Set<string>,
  todayISO: string,
  sinceISO: string | null,
  lookback = 8,
): string[] {
  const out: string[] = [];
  const currentKey = weekKeyOf(todayISO);
  const dow = (new Date(utcMs(todayISO)).getUTCDay() + 6) % 7; // 0 = segunda
  let key = dow >= 4 ? currentKey : previousWeekKey(currentKey);
  for (let i = 0; i < lookback; i += 1) {
    const r = weekRange(key);
    if (!r) break;
    if (sinceISO && r.end < sinceISO) break;
    if (!reportedWeekKeys.has(key)) out.push(key);
    key = previousWeekKey(key);
  }
  return out;
}

/** A primeira semana que o consultor ainda pode reportar (anterior antes da
 *  corrente), ou null quando está tudo em dia. */
export function nextReportableWeek(reportedWeekKeys: Set<string>, todayISO: string): string | null {
  return reportableWeeks(todayISO).find((k) => !reportedWeekKeys.has(k)) ?? null;
}

/** Nome próprio. */
export function firstName(full: string): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

/** «13/10/2026 11:19» — data e hora em Lisboa, igual no servidor (UTC) e no
 *  browser. A assinatura guarda-se em UTC e mostra-se em hora local. */
export function formatLisbonDateTime(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}
