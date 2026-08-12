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

export type AbsenceStatus = "pending" | "approved" | "rejected";

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
  /** Referência humana sequencial — "AUS-2026-007". É o número que se cita
   *  no Slack, no sino e na folha. */
  ref: string;
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
  reason: AbsenceReasonId;
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
