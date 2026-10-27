// Ineficácias — o que é partilhado entre o browser e o servidor: os tipos,
// os catálogos (motivos, quem deu pelo erro, a escala 0–10), a validação do
// relatório e a DERIVAÇÃO do estado de cada consultor (PA, NO, nível, medida
// por aplicar). Puro: sem KV, sem relógio — o «hoje» entra sempre por
// parâmetro, como no probation.
//
// AS REGRAS (slides «As ineficácias — o que conta e quanto vale» + a resposta
// da Beatriz no Slack, 2026-09-30):
//   • Cada ocorrência vale de 0 a 10 pontos, dados pela DIREÇÃO depois de o
//     consultor a reportar (ou registados por ela). Só uma ocorrência
//     pontuada (> 0) entra nas contas.
//   • PA = soma dos pontos · NO = número de ocorrências, acumulados na FASE:
//     desde o último 1:1 de nível (ou desde sempre). Os erros não saem ao fim
//     de 30 dias — só o 1:1 põe os contadores a zero (v78.21, regra da
//     Beatriz confirmada pelo André a 2026-10-27; até aí havia uma janela
//     de 30 dias).
//   • Nível 1: PA ≥ 6 ou NO ≥ 3 → 1:1 com o líder direto, plano de 1 a 3 ações.
//     Nível 2 (depois do 1): PA ≥ 6 ou NO ≥ 2 → 1:1 com o nível acima.
//     Nível 3 (depois do 2): PA ≥ 6 ou NO ≥ 2 → probation.
//   • «Sempre que uma reunião de Nível (1:1) é realizada, os contadores (PA e
//     NO) reiniciam a zero para a fase seguinte. Contudo, a progressão de
//     níveis é linear e cumulativa.» E «reinicia mas não se apagam as
//     ineficácias» — o histórico fica.
//   • Uma falha grave sozinha pode levar a probation direto — a direção pode
//     definir o nível à mão, com justificação.
//
// O RELATÓRIO (v77.90): o consultor assina um relatório quando quiser, a
// qualquer hora, com um ou mais erros — já não há semanas nem relatórios
// «sem erros».

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

/** Erro de aprendizagem ou de recorrência (v77.93) — a direção indica-o na
 *  folha RH-04 e pesa na calculadora. */
export type IneficaciaErrorType = "aprendizagem" | "recorrencia";

export const ERROR_TYPES: { id: IneficaciaErrorType; label: string; hint: string }[] = [
  { id: "aprendizagem", label: "Erro de aprendizagem", hint: "Tarefa ou processo ainda novo — faz parte de aprender." },
  { id: "recorrencia", label: "Erro de recorrência", hint: "Já sabia fazer ou já tinha acontecido — não devia repetir-se." },
];

export function errorTypeLabel(id: IneficaciaErrorType): string {
  return ERROR_TYPES.find((t) => t.id === id)?.label ?? id;
}

/** O que o erro causou — as caixas da calculadora. A `base` de cada uma
 *  cai na banda da escala com a mesma descrição. */
export type IneficaciaImpact = "refazer" | "prazo" | "cliente" | "negocio";

export const IMPACTS: { id: IneficaciaImpact; label: string; hint: string; base: number }[] = [
  { id: "refazer", label: "Obrigou a refazer trabalho", hint: "O próprio ou um colega teve de voltar atrás.", base: 4 },
  { id: "prazo", label: "Atrasou um prazo ou entrega", hint: "Algo saiu tarde ou ficou por entregar.", base: 5 },
  { id: "cliente", label: "Chegou ao cliente", hint: "O cliente viu ou sentiu o erro.", base: 7 },
  { id: "negocio", label: "Risco para o negócio", hint: "Dinheiro, dados, contrato ou reputação em jogo.", base: 9 },
];

/** Os pesos da calculadora (v77.93). A base é o impacto mais pesado
 *  assinalado; o resto soma ou subtrai, e o total fica entre 1 e 10. */
export const SCORE_RULES = {
  /** Sem nenhuma caixa de impacto — recuperável no próprio dia. */
  noImpactBase: 2,
  /** Cada impacto a mais além do principal, até `extraImpactCap`. */
  extraImpact: 1,
  extraImpactCap: 2,
  reason: { atencao: 1, protocolo: -1, tempo: 0, outro: 0 } as Record<IneficaciaReason, number>,
  repeated: 2,
  errorType: { aprendizagem: -1, recorrencia: 1 } as Record<IneficaciaErrorType, number>,
  noticed: { proprio: -1, equipa: 0, cliente: 0 } as Record<IneficaciaNoticed, number>,
};

export type ScoreSuggestionInput = {
  impacts: IneficaciaImpact[];
  reason: IneficaciaReason | null;
  firstTime: boolean | null;
  errorType: IneficaciaErrorType | null;
  noticed: IneficaciaNoticed | null;
};

export type ScoreSuggestion = {
  /** 1–10 — o que a calculadora sugere. */
  points: number;
  /** A soma antes de limitar a 1–10. */
  raw: number;
  band: ScoreBand;
  /** As parcelas, pela ordem em que se somam. `base` = o ponto de partida. */
  lines: { label: string; value: number; base?: boolean }[];
  /** O que falta responder — conta 0 até ser respondido. */
  missing: string[];
};

/** A pontuação sugerida pela calculadora da folha RH-04. Pura — corre no
 *  browser (ao vivo) e no servidor (a sugestão que fica gravada). */
export function suggestScore(input: ScoreSuggestionInput): ScoreSuggestion {
  const lines: ScoreSuggestion["lines"] = [];
  const missing: string[] = [];

  // Foi o cliente a dar pelo erro → o erro chegou ao cliente.
  const ids = new Set(input.impacts);
  const viaNoticed = input.noticed === "cliente" && !ids.has("cliente");
  if (viaNoticed) ids.add("cliente");
  const impacts = IMPACTS.filter((i) => ids.has(i.id)).sort((a, b) => b.base - a.base);

  if (impacts.length === 0) {
    lines.push({ label: "Sem impacto assinalado — recuperável no próprio dia", value: SCORE_RULES.noImpactBase, base: true });
  } else {
    const [main, ...rest] = impacts;
    const why = main.id === "cliente" && viaNoticed ? " (foi o cliente que deu pelo erro)" : "";
    lines.push({ label: `${main.label}${why}`, value: main.base, base: true });
    rest.slice(0, SCORE_RULES.extraImpactCap).forEach((i) => {
      lines.push({ label: `Também: ${i.label.toLowerCase()}`, value: SCORE_RULES.extraImpact });
    });
  }

  if (input.reason) {
    const r = REASONS.find((x) => x.id === input.reason);
    lines.push({ label: `Motivo ${r?.letter ?? ""} — ${(r?.label ?? "").toLowerCase()}`, value: SCORE_RULES.reason[input.reason] });
  } else missing.push("motivo");

  if (input.firstTime === null) missing.push("primeira vez");
  else lines.push({ label: input.firstTime ? "Primeira vez" : "Repetido", value: input.firstTime ? 0 : SCORE_RULES.repeated });

  if (input.errorType) lines.push({ label: errorTypeLabel(input.errorType), value: SCORE_RULES.errorType[input.errorType] });
  else missing.push("aprendizagem ou recorrência");

  if (input.noticed) {
    lines.push({ label: noticedLabel(input.noticed), value: SCORE_RULES.noticed[input.noticed] });
  } else missing.push("quem deu pelo erro");

  const raw = lines.reduce((s, l) => s + l.value, 0);
  const points = Math.min(MAX_POINTS, Math.max(1, raw));
  return { points, raw, band: bandOf(points), lines, missing };
}

export type IneficaciaLevel = 0 | 1 | 2 | 3;

export const LEVELS: { level: IneficaciaLevel; title: string; rule: string; measure: string }[] = [
  { level: 0, title: "Nível 0", rule: "PA até 5 e NO até 2", measure: "Correção no momento, pelo líder direto." },
  { level: 1, title: "Nível 1", rule: "PA ≥ 6 ou NO ≥ 3", measure: "1:1 com o líder direto e plano de 1 a 3 ações." },
  { level: 2, title: "Nível 2", rule: "depois do 1: PA ≥ 6 ou NO ≥ 2", measure: "1:1 com o nível acima e medidas extra." },
  { level: 3, title: "Nível 3", rule: "depois do 2: PA ≥ 6 ou NO ≥ 2", measure: "Probation: plano escrito, KPIs e cadência." },
];

/** Até quantos dias atrás o consultor pode reportar um erro — a janela das
 *  contas. A direção pode registar até um ano atrás. */
export const REPORT_LOOKBACK_DAYS = 30;
export const DIRECT_LOOKBACK_DAYS = 365;

/** O limiar para ATINGIR um nível (a partir do anterior). */
export function thresholdToReach(level: 1 | 2 | 3): { pa: number; no: number } {
  return { pa: 6, no: level === 1 ? 3 : 2 };
}

export const DECLARATION_TEXT =
  "Declaro que este relatório é completo e verdadeiro e que reportei todos os erros de que tenho conhecimento.";

/** O valor do campo «Cliente ou projeto» quando o erro não foi num cliente. */
export const INTERNAL_CLIENT = "Interno";

/** Um cliente no dropdown da folha RH-03 (v77.91). */
export type ClientChoice = { slug: string; title: string; icon: string | null; depts: string[] };
export type ClientChoices = { mine: ClientChoice[]; others: ClientChoice[] };

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
  /** Data em que ocorreu — nos últimos 30 dias (YYYY-MM-DD). */
  occurredOn: string;
  /** Se percebeu o erro que cometeu. */
  noticed: IneficaciaNoticed | null;
  /** A gravidade na autoavaliação do consultor, 0–10 (v78.23). */
  selfScore: number | null;
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
  /** A gravidade na autoavaliação do consultor, 0–10 — null nos relatórios
   *  anteriores à v78.23. Faz parte do conteúdo assinado. */
  selfScore: number | null;
  /** A pontuação da direção — null enquanto está por pontuar. */
  score: IneficaciaScore | null;
  /** A calculadora da direção ao pontuar (v77.94) — null/[] até a direção
   *  a usar. Fora do conteúdo assinado e NUNCA mostrada ao consultor (ver
   *  redactForConsultant). */
  errorType: IneficaciaErrorType | null;
  impacts: IneficaciaImpact[];
  suggestedPoints: number | null;
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
  /** O dia da assinatura em Lisboa (YYYY-MM-DD). */
  submittedOn: string;
  items: IneficaciaItem[];
  signature: IneficaciaSignature;
  createdAt: number;
  /** A revisão da direção — fica preenchida quando todas as ocorrências têm
   *  pontuação. */
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
  /** Primeira vez que o consultor cometeu este erro? null = não indicado
   *  (registos anteriores à v77.90). */
  firstTime: boolean | null;
  lastTime: string;
  occurredOn: string;
  noticed: IneficaciaNoticed;
  /** Aprendizagem ou recorrência — null nos registos anteriores à v77.93. */
  errorType: IneficaciaErrorType | null;
  /** As caixas de impacto da calculadora ([] nos registos antigos). */
  impacts: IneficaciaImpact[];
  /** A pontuação que a calculadora sugeriu (null nos registos antigos). */
  suggestedPoints: number | null;
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
  occurredOn: string;
  what: string;
  client: string;
  reason: IneficaciaReason;
  reasonOther: string;
  shouldHave: string;
  firstTime: boolean | null;
  lastTime: string;
  noticed: IneficaciaNoticed;
  /** A classificação da direção (aprendizagem/recorrência) — null quando
   *  não foi dada e SEMPRE null nas vistas do consultor. */
  errorType: IneficaciaErrorType | null;
  score: IneficaciaScore | null;
};

/* ------------------------------------------------------------------ */
/*  Datas                                                               */
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

/** DD/MM — para datas próximas. */
export function formatISODayMonth(iso: string): string {
  if (!isISODate(iso)) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** O dia (YYYY-MM-DD) em Lisboa de um instante. */
export function lisbonDateOf(v: number | string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date(v));
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

/** «daqui a 12 dias» · «amanhã» · «hoje». */
export function inDaysLabel(days: number): string {
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  return `daqui a ${days} dias`;
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

/** Uma autoavaliação válida: inteiro de 0 a 10. */
export function isSelfScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_POINTS;
}

/** O intervalo de datas que o consultor pode indicar hoje. */
export function reportDateRange(todayISO: string): { min: string; max: string } {
  return { min: addDaysISO(todayISO, -REPORT_LOOKBACK_DAYS), max: todayISO };
}

/** O problema de uma ocorrência, ou null se está completa. `n` é o número
 *  humano (1-based) para a mensagem. */
export function validateItem(
  item: IneficaciaItemDraft,
  range: { min: string; max: string },
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
  if (item.occurredOn > range.max) return `${tag} a data não pode ser no futuro.`;
  if (item.occurredOn < range.min) return `${tag} só podes reportar erros dos últimos ${REPORT_LOOKBACK_DAYS} dias (desde ${formatISODate(range.min)}).`;
  if (!item.noticed) return `${tag} diz se percebeste o erro que cometeste.`;
  if (!isSelfScore(item.selfScore)) return `${tag} indica a gravidade, de 0 a ${MAX_POINTS}, na tua avaliação.`;
  return null;
}

export type ReportDraft = {
  items: IneficaciaItemDraft[];
  declaration: boolean;
  signatureName: string;
};

/** O problema do relatório inteiro, ou null. `expectedName` é o nome
 *  completo registado na conta. */
export function validateReport(
  draft: ReportDraft,
  ctx: { todayISO: string; expectedName: string },
): string | null {
  if (draft.items.length === 0) return "Descreve pelo menos um erro.";
  if (draft.items.length > LIMITS.maxItems) return `No máximo ${LIMITS.maxItems} erros por relatório.`;
  const range = reportDateRange(ctx.todayISO);
  for (let i = 0; i < draft.items.length; i += 1) {
    const p = validateItem(draft.items[i], range, i + 1);
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
    selfScore: isSelfScore(it.selfScore) ? it.selfScore : null,
    score: null,
    errorType: null,
    impacts: [],
    suggestedPoints: null,
  }));
}

/* ------------------------------------------------------------------ */
/*  Conteúdo canónico (o que o hash SHA-256 cobre)                     */
/* ------------------------------------------------------------------ */

/** O conteúdo do relatório tal como o consultor o assinou — SEM as
 *  pontuações nem a revisão da direção, que chegam depois e não podem
 *  invalidar a assinatura. A ordem dos campos é fixa de propósito: o hash
 *  tem de ser reproduzível para verificar a integridade mais tarde.
 *
 *  v3 (v78.23) junta a autoavaliação de cada erro. Um relatório sem ela
 *  (os anteriores) continua a dar exatamente o JSON da v2 — o hash que foi
 *  assinado nessa altura continua a bater. */
export function canonicalContent(r: {
  username: string;
  submittedOn: string;
  items: (Pick<
    IneficaciaItem,
    "what" | "client" | "reason" | "reasonOther" | "shouldHave" | "firstTime" | "lastTime" | "occurredOn" | "noticed"
  > & { selfScore?: number | null })[];
  fullName: string;
}): string {
  const withSelf = r.items.some((it) => isSelfScore(it.selfScore));
  return JSON.stringify({
    v: withSelf ? 3 : 2,
    username: r.username,
    submittedOn: r.submittedOn,
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
      ...(withSelf ? { selfScore: isSelfScore(it.selfScore) ? it.selfScore : null } : {}),
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
        occurredOn: it.occurredOn,
        what: it.what,
        client: it.client,
        reason: it.reason,
        reasonOther: it.reasonOther,
        shouldHave: it.shouldHave,
        firstTime: it.firstTime,
        lastTime: it.lastTime,
        noticed: it.noticed,
        errorType: it.errorType,
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
      occurredOn: d.occurredOn,
      what: d.what,
      client: d.client,
      reason: d.reason,
      reasonOther: d.reasonOther,
      shouldHave: d.shouldHave,
      firstTime: d.firstTime,
      lastTime: d.lastTime,
      noticed: d.noticed,
      errorType: d.errorType,
      score: d.score,
    });
  }
  return out.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
}

/** A avaliação da direção — o tipo de erro, os impactos e a sugestão da
 *  calculadora — é só da direção: o consultor vê o erro e a pontuação, nunca
 *  a calculadora. Tudo o que chega ao consultor passa por aqui. */
export function redactForConsultant(reports: IneficaciaReport[], ledger: IneficaciaLedger): {
  reports: IneficaciaReport[];
  ledger: IneficaciaLedger;
} {
  const clean = { errorType: null, impacts: [], suggestedPoints: null };
  return {
    reports: reports.map((r) => ({ ...r, items: r.items.map((it) => ({ ...it, ...clean })) })),
    ledger: { ...ledger, direct: ledger.direct.map((d) => ({ ...d, ...clean })) },
  };
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
  /** A partir de que dia as ocorrências contam na fase corrente (null =
   *  desde sempre: ainda não houve nenhum 1:1). */
  phaseStart: string | null;
  /** PA e NO da fase corrente (só ocorrências pontuadas > 0). */
  pa: number;
  no: number;
  /** Ocorrências da fase por pontuar — ainda fora das contas. */
  unscored: number;
  /** O limiar do próximo nível (null quando já está no 3). */
  next: { level: 1 | 2 | 3; pa: number; no: number } | null;
  /** As ocorrências que contam na fase corrente. */
  counted: Occurrence[];
};

function eventOrder(a: LedgerEvent, b: LedgerEvent): number {
  return a.at.localeCompare(b.at) || a.createdAt - b.createdAt;
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
  const level: IneficaciaLevel = phaseEvent ? phaseEvent.level : 0;
  // As ocorrências DO DIA da reunião ficam na fase anterior: a fase nova
  // começa no dia seguinte.
  const phaseStart = phaseEvent ? addDaysISO(phaseEvent.at, 1) : null;
  const phaseFrom = phaseEvent ? phaseEvent.at : null; // exclusivo

  const inPhase = occurrences
    .filter((o) => (phaseFrom === null || o.occurredOn > phaseFrom) && o.occurredOn <= todayISO)
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

  const current = tally(inPhase, phaseFrom, todayISO);
  const unscored = inPhase.filter((o) => !o.score).length;

  const nextLevel = level < 3 ? ((level + 1) as 1 | 2 | 3) : null;
  const next = nextLevel ? { level: nextLevel, ...thresholdToReach(nextLevel) } : null;

  // A medida fica por aplicar a partir do dia em que a soma da fase passou o
  // limiar, até a direção registar o 1:1.
  let pendingMeasure: PendingMeasure | null = null;
  if (next) {
    for (const o of inPhase) {
      if (!counts(o)) continue;
      const upTo = tally(inPhase, phaseFrom, o.occurredOn);
      if (upTo.pa >= next.pa || upTo.no >= next.no) {
        pendingMeasure = { level: next.level, since: o.occurredOn, pa: upTo.pa, no: upTo.no };
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
    pa: current.pa,
    no: current.no,
    unscored,
    next,
    counted: current.list.slice().sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
  };
}

/** Nome próprio. */
export function firstName(full: string): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}
