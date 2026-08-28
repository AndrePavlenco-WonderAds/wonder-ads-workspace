// Ausências — tipos e regras partilhadas entre o browser e o servidor.
//
// Vive separado de `absences-store.ts` pela mesma razão de sempre neste
// repo (ver web-tickets-shared): a folha de pedido é um componente "use
// client" e precisa do catálogo de motivos, dos tipos e da matemática dos
// dias para dar feedback ao vivo — mas não pode puxar o import do KV para
// o bundle. O servidor RE-VALIDA tudo com estas mesmas funções, para que
// o que o formulário mostra e o que a API aceita nunca divirjam.

/** Como é que a ausência ocupa o calendário. "Uma semana" do pedido do
 *  C-Level não é um tipo próprio — é um multi-day com 7 dias, e a folha
 *  tem um atalho que preenche as datas. */
export type AbsencePeriodKind = "morning" | "afternoon" | "full-day" | "multi-day";

/** "recorded" é o estado das FALTAS: não há decisão pendente nem aprovação
 *  — o C-Level lançou o registo e ele já é um facto. Fica na mesma união
 *  para que o compilador obrigue a tratar as faltas em todo o lado que hoje
 *  faz contas com estados. */
export type AbsenceStatus = "pending" | "approved" | "rejected" | "recorded";

/** De onde veio o registo. "request" é a folha RH-01 que o próprio assina e
 *  espera decisão; "falta" é a folha RH-02 que só o C-Level abre, para
 *  lançar uma falta a alguém — nasce já decidida e o único ato que resta é
 *  a pessoa acusá-la como entendida. */
export type AbsenceKind = "request" | "falta";

export type AbsenceReasonId =
  | "ferias"
  | "doenca"
  | "consulta"
  | "familia"
  | "luto"
  | "casamento"
  | "parentalidade"
  | "estudos"
  | "mudanca"
  | "pessoal"
  | "outro";

export type AbsenceAttachment = {
  url: string;
  name: string;
  size: number;
  contentType: string;
};

export type AbsenceRequest = {
  id: string;
  /** Referência humana sequencial — "AUS-2026-007" nos pedidos,
   *  "FAL-2026-003" nas faltas. É o número que se cita no Slack, no sino e
   *  na folha. */
  ref: string;
  /** Pedido do próprio ou falta lançada pelo C-Level. Os registos gravados
   *  antes das faltas existirem não têm o campo — o `sanitizeAbsence`
   *  devolve "request" a esses. */
  kind: AbsenceKind;
  /** Só nas faltas: se conta como justificada. `null` num pedido normal (e
   *  numa falta de motivo "outro" que ainda não foi classificada). */
  justified: boolean | null;
  username: string;
  /** Identidade congelada no momento da submissão — cargos mudam, o registo
   *  daquela folha não. */
  name: string;
  role: string;
  dept: string;
  periodKind: AbsencePeriodKind;
  /** ISO yyyy-mm-dd. Nos meios-dias e no dia inteiro, end === start. */
  startDate: string;
  endDate: string;
  /** Dias corridos pedidos — 0.5 nos meios-dias. É sobre ESTE número que
   *  vive o teto dos 20 dias. */
  calendarDays: number;
  /** Dias úteis (seg–sex) dentro do período — 0.5 nos meios-dias úteis. */
  businessDays: number;
  /** Id do motivo no catálogo do respetivo `kind` — ABSENCE_REASONS num
   *  pedido, FALTA_REASONS numa falta. Os dois têm "outro", que é o valor
   *  de recurso quando o id gravado já não existe. */
  reason: AbsenceReasonId | FaltaReasonId;
  /** Rótulo congelado para o histórico não depender do catálogo atual. */
  reasonLabel: string;
  details: string;
  /** Contacto durante a ausência (opcional). */
  contact: string;
  /** Passagem de trabalho / quem cobre (opcional). */
  handover: string;
  attachment: AbsenceAttachment | null;
  /** Nome tal como a pessoa o escreveu na linha de assinatura. */
  signatureName: string;
  createdAt: number;
  status: AbsenceStatus;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: number | null;
  decisionNote: string | null;
  decidedVia: "app" | "slack" | null;
  /** Quando o próprio carregou em «Entendido» na notificação da resposta. */
  acknowledgedAt: number | null;
};

/** Teto do pedido — em dias corridos, incluindo fins de semana. */
export const MAX_ABSENCE_CALENDAR_DAYS = 20;

export const ABSENCE_REASONS: {
  id: AbsenceReasonId;
  label: string;
  /** O que a folha exige de comprovativo. "required" trava a submissão sem
   *  anexo; "recommended" deixa passar mas avisa que fica em falta. */
  proof: "required" | "recommended" | "none";
  emoji: string;
}[] = [
  { id: "ferias", label: "Férias", proof: "none", emoji: "🌴" },
  { id: "doenca", label: "Doença / Baixa médica", proof: "required", emoji: "🤒" },
  { id: "consulta", label: "Consulta ou exame médico", proof: "recommended", emoji: "🩺" },
  { id: "familia", label: "Assistência à família", proof: "recommended", emoji: "👨‍👩‍👧" },
  { id: "luto", label: "Falecimento de familiar", proof: "none", emoji: "🕊️" },
  { id: "casamento", label: "Casamento", proof: "none", emoji: "💍" },
  { id: "parentalidade", label: "Parentalidade", proof: "recommended", emoji: "👶" },
  { id: "estudos", label: "Formação / Provas académicas", proof: "recommended", emoji: "🎓" },
  { id: "mudanca", label: "Mudança de casa", proof: "none", emoji: "📦" },
  { id: "pessoal", label: "Assuntos pessoais", proof: "none", emoji: "🧭" },
  { id: "outro", label: "Outro motivo", proof: "none", emoji: "✏️" },
];

export function reasonById(id: string | null | undefined) {
  return ABSENCE_REASONS.find((r) => r.id === id) ?? null;
}

/* ---------------------------------------------------------------- *
 * FALTAS — o outro lado da folha.                                   *
 *                                                                   *
 * O catálogo é PRÓPRIO, e não os motivos do pedido, porque o ato é   *
 * outro: aqui não se está a pedir férias, está-se a registar que     *
 * alguém faltou. Cada motivo já traz a marca de justificada ou       *
 * injustificada — é o que separa "esteve doente e avisou depois" de  *
 * "não apareceu", e é essa marca que faz o contador do ano não       *
 * misturar dias de férias aprovados com faltas.                     *
 * ---------------------------------------------------------------- */

export type FaltaReasonId =
  | "injustificada"
  | "justificada"
  | "atraso"
  | "saida-antecipada"
  | "doenca-sem-aviso"
  | "outro";

export const FALTA_REASONS: {
  id: FaltaReasonId;
  label: string;
  /** `null` = o C-Level escolhe na folha (é o caso de "Outro motivo"). */
  justified: boolean | null;
  emoji: string;
  /** A frase que a pessoa lê na notificação, na primeira pessoa. */
  hint: string;
}[] = [
  {
    id: "injustificada",
    label: "Falta injustificada",
    justified: false,
    emoji: "⚠️",
    hint: "Ausência sem aviso nem justificação aceite.",
  },
  {
    id: "justificada",
    label: "Falta justificada",
    justified: true,
    emoji: "📄",
    hint: "Ausência com motivo aceite pelo C-Level.",
  },
  {
    id: "atraso",
    label: "Atraso",
    justified: false,
    emoji: "⏰",
    hint: "Entrada depois da hora, sem aviso prévio.",
  },
  {
    id: "saida-antecipada",
    label: "Saída antecipada",
    justified: false,
    emoji: "🚪",
    hint: "Saída antes da hora, sem autorização prévia.",
  },
  {
    id: "doenca-sem-aviso",
    label: "Doença sem aviso prévio",
    justified: true,
    emoji: "🤒",
    hint: "Ausência por saúde comunicada só depois do facto.",
  },
  {
    id: "outro",
    label: "Outro motivo",
    justified: null,
    emoji: "✏️",
    hint: "Descrito pelo C-Level na folha.",
  },
];

export function faltaReasonById(id: string | null | undefined) {
  return FALTA_REASONS.find((r) => r.id === id) ?? null;
}

/** "Justificada" / "Injustificada" / "Por classificar". */
export function justifiedLabel(justified: boolean | null): string {
  if (justified === true) return "Justificada";
  if (justified === false) return "Injustificada";
  return "Por classificar";
}

export const PERIOD_KIND_LABEL: Record<AbsencePeriodKind, string> = {
  morning: "Meio dia — manhã",
  afternoon: "Meio dia — tarde",
  "full-day": "Dia inteiro",
  "multi-day": "Vários dias",
};

/** yyyy-mm-dd válido e real (rejeita 2026-02-31). */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return toLocalISO(d) === value;
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Dias corridos entre duas datas ISO, inclusive. 0 quando inválido. */
export function calendarDaySpan(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diff < 0 ? 0 : diff + 1;
}

/** Dias úteis (seg–sex) entre duas datas ISO, inclusive. */
export function businessDaySpan(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** A duração de um pedido, já com a regra dos meios-dias. É a MESMA função
 *  do contador ao vivo da folha e da validação da API. */
export function absenceDuration(
  kind: AbsencePeriodKind,
  startISO: string,
  endISO: string,
): { calendarDays: number; businessDays: number } {
  if (kind === "morning" || kind === "afternoon") {
    const business = businessDaySpan(startISO, startISO) > 0 ? 0.5 : 0;
    return { calendarDays: 0.5, businessDays: business };
  }
  if (kind === "full-day") {
    return {
      calendarDays: 1,
      businessDays: businessDaySpan(startISO, startISO),
    };
  }
  return {
    calendarDays: calendarDaySpan(startISO, endISO),
    businessDays: businessDaySpan(startISO, endISO),
  };
}

/** "meio dia" / "1 dia" / "5 dias". Aceita meios (0.5, 2.5). */
export function formatDayCount(days: number): string {
  if (days === 0.5) return "meio dia";
  if (days === 1) return "1 dia";
  if (Number.isInteger(days)) return `${days} dias`;
  return `${String(days).replace(".", ",")} dias`;
}

/** "1 dia útil" / "meio dia útil" / "5 dias úteis" — o plural certo para
 *  dias úteis, que é o que o balanço do mês e o cartão mostram. */
export function formatBusinessDays(days: number): string {
  if (days === 1) return "1 dia útil";
  if (days === 0.5) return "meio dia útil";
  return `${formatDayCount(days)} úteis`;
}

/** "17/08/2026 → 21/08/2026 · Vários dias" — a mesma linha em todo o lado:
 *  Slack, sino, folha, Control Suite. */
export function absencePeriodLine(
  a: Pick<AbsenceRequest, "startDate" | "endDate" | "periodKind">,
): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };
  const range =
    a.startDate === a.endDate
      ? fmt(a.startDate)
      : `${fmt(a.startDate)} → ${fmt(a.endDate)}`;
  return `${range} · ${PERIOD_KIND_LABEL[a.periodKind]}`;
}

/** "5 dias corridos · 5 dias úteis" (ou "meio dia" nos meios-dias). */
export function absenceDurationLine(
  a: Pick<AbsenceRequest, "calendarDays" | "businessDays" | "periodKind">,
): string {
  if (a.periodKind === "morning" || a.periodKind === "afternoon") {
    return PERIOD_KIND_LABEL[a.periodKind].toLowerCase();
  }
  return `${formatDayCount(a.calendarDays)} corridos · ${formatDayCount(a.businessDays)} úteis`;
}

export type AbsenceDraft = {
  periodKind: AbsencePeriodKind;
  startDate: string;
  endDate: string;
  reason: AbsenceReasonId;
  details: string;
  contact: string;
  handover: string;
  hasAttachment: boolean;
  signatureName: string;
};

export type FaltaDraft = {
  username: string;
  periodKind: AbsencePeriodKind;
  startDate: string;
  endDate: string;
  reason: FaltaReasonId | null;
  justified: boolean | null;
  details: string;
  signatureName: string;
};

/** A validação da folha de FALTA. Mesma filosofia da do pedido: corre no
 *  browser para o botão de assinar e OUTRA VEZ na API, que é a fonte de
 *  verdade. A diferença é que aqui há um colaborador a escolher — e ele é a
 *  primeira coisa que falta. */
export function validateFaltaDraft(draft: FaltaDraft): string | null {
  if (!draft.username) return "Escolhe o colaborador a quem a falta diz respeito.";
  if (!isValidISODate(draft.startDate)) return "Escolhe a data da falta.";
  const singleDay = draft.periodKind !== "multi-day";
  const end = singleDay ? draft.startDate : draft.endDate;
  if (!isValidISODate(end)) return "Escolhe a data de fim.";
  if (end < draft.startDate)
    return "A data de fim não pode ser antes da de início.";
  const { calendarDays } = absenceDuration(draft.periodKind, draft.startDate, end);
  if (calendarDays <= 0) return "O período indicado está vazio.";
  if (calendarDays > MAX_ABSENCE_CALENDAR_DAYS)
    return `O máximo por registo são ${MAX_ABSENCE_CALENDAR_DAYS} dias corridos — este período tem ${formatDayCount(calendarDays)}. Lança em dois registos.`;
  const reason = faltaReasonById(draft.reason);
  if (!reason) return "Escolhe o motivo da falta.";
  if (reason.justified === null && draft.justified === null)
    return "Com «Outro motivo», marca se a falta é justificada ou injustificada.";
  if (draft.reason === "outro" && draft.details.trim().length < 10)
    return "Com «Outro motivo», descreve a falta no campo de detalhe (mínimo 10 caracteres).";
  if (draft.signatureName.trim().length < 3)
    return "Assina com o teu nome completo na secção 5.";
  return null;
}

/** A validação da folha — devolve a primeira coisa que falta, em linguagem
 *  de gente, ou null quando o pedido está pronto a assinar. Corre no browser
 *  (para o botão de assinar) e OUTRA VEZ na API (fonte de verdade). */
export function validateAbsenceDraft(draft: AbsenceDraft): string | null {
  if (!isValidISODate(draft.startDate)) return "Escolhe a data de início.";
  const singleDay = draft.periodKind !== "multi-day";
  const end = singleDay ? draft.startDate : draft.endDate;
  if (!isValidISODate(end)) return "Escolhe a data de fim.";
  if (end < draft.startDate)
    return "A data de fim não pode ser antes da de início.";
  const { calendarDays } = absenceDuration(draft.periodKind, draft.startDate, end);
  if (calendarDays <= 0) return "O período pedido está vazio.";
  if (calendarDays > MAX_ABSENCE_CALENDAR_DAYS)
    return `O máximo por pedido são ${MAX_ABSENCE_CALENDAR_DAYS} dias corridos — este período tem ${formatDayCount(calendarDays)}. Divide em dois pedidos ou fala diretamente com o C-Level.`;
  const reason = reasonById(draft.reason);
  if (!reason) return "Escolhe o motivo da ausência.";
  if (reason.proof === "required" && !draft.hasAttachment)
    return `Para «${reason.label}» é obrigatório anexar o comprovativo médico.`;
  if (draft.reason === "outro" && draft.details.trim().length < 10)
    return "Com «Outro motivo», descreve a razão no campo de detalhe (mínimo 10 caracteres).";
  if (draft.signatureName.trim().length < 3)
    return "Assina com o teu nome completo na secção 5.";
  return null;
}

/* ---------------------------------------------------------------- *
 * A MATEMÁTICA DO MÊS                                               *
 *                                                                   *
 * Uma ausência de 28/06 a 04/07 não é "de junho" nem "de julho" — é  *
 * das duas. Quem processa salários precisa dos dias QUE CAEM DENTRO  *
 * do mês, não do mês em que a folha calhou começar. Por isso o       *
 * resumo mensal não filtra por data de início: recorta cada registo  *
 * contra a janela do mês e conta só o que lá está dentro.            *
 * ---------------------------------------------------------------- */

/** Primeiro e último dia (ISO) de um mês. `month` é 1–12. */
export function monthBounds(year: number, month: number): {
  from: string;
  to: string;
} {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

export const MONTH_NAMES_PT = [
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

/** "Julho de 2026" — para o cabeçalho do resumo. */
export function monthLabelPT(year: number, month: number): string {
  const name = MONTH_NAMES_PT[month - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`;
}

/** A fatia de um registo que cai dentro de [fromISO, toISO], em dias.
 *  Devolve zeros quando não há sobreposição nenhuma. */
export function absencePortionInRange(
  a: Pick<
    AbsenceRequest,
    "periodKind" | "startDate" | "endDate"
  >,
  fromISO: string,
  toISO: string,
): { calendarDays: number; businessDays: number } {
  const none = { calendarDays: 0, businessDays: 0 };
  if (!a.startDate) return none;

  // Meios-dias e dias inteiros vivem num dia só: ou esse dia está na janela,
  // ou o registo não conta para este mês.
  if (a.periodKind !== "multi-day") {
    if (a.startDate < fromISO || a.startDate > toISO) return none;
    return absenceDuration(a.periodKind, a.startDate, a.startDate);
  }

  const start = a.startDate > fromISO ? a.startDate : fromISO;
  const end = (a.endDate || a.startDate) < toISO ? a.endDate || a.startDate : toISO;
  if (end < start) return none;
  return {
    calendarDays: calendarDaySpan(start, end),
    businessDays: businessDaySpan(start, end),
  };
}
