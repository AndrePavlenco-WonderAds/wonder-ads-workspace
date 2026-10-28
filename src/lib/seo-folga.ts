// Folga de custos de um projeto SEO (v78.37) — o dinheiro que cada projeto
// tem, por mês, para extras que oferecemos ao cliente sem os cobrar.
//
// COMO FUNCIONA
//  • Cada projeto tem uma folga MENSAL (a tabela do André, em FOLGA_DEFAULTS;
//    a direção pode mudá-la na página, a partir de um mês). No dia 1 de cada
//    mês entra a folga desse mês.
//  • É ACUMULÁVEL: o que não se gasta passa para o mês seguinte, e o que se
//    gasta a mais também passa (um saldo negativo come a folga do mês a
//    seguir). O saldo nunca se apaga: é a soma das folgas menos os extras.
//  • Um extra pode SAIR DA FOLGA (oferecido ao cliente) ou ser COBRADO ao
//    cliente — esse fica no registo mas não mexe no saldo.
//  • Os clientes Lite têm folga 0: o bloco aparece, já «esgotado», e todos
//    os extras são cobrados.
//  • Nada se apaga: um extra lançado por engano é ANULADO, com motivo, e
//    continua visível no registo.
//
// Módulo puro (sem KV): a página, o chip e a API fazem as contas daqui.

import type { ClientTier } from "@/lib/client-tiers";

/** O primeiro mês com folga. */
export const FOLGA_START = "2026-10";

/** Folga mensal por projeto, em euros (tabela do André, 28/10/2026). */
export const FOLGA_DEFAULTS: Record<string, number> = {
  "atn-medical": 35,
  "cidalia-cabeleireiros": 272.5,
  medway: 695,
  "physio-hub": 426.67,
  "antonio-gaspar": 426.67,
  brancoptica: 272.5,
  "clinica-fernando-almeida": 295,
  "spine-center": 195,
  "white-clinic": 211.26,
  mymedic: 172.5,
  "sentir-saude": 125,
  "monte-mar": 76.67,
  "maratona-clube-de-portugal": 60,
};

export const FOLGA_CATEGORIES = [
  { id: "conteudo", label: "Conteúdo extra" },
  { id: "design", label: "Design e imagens" },
  { id: "backlinks", label: "Backlinks, PR e Imprensa" },
  { id: "wikipedia", label: "Wikipedia Page" },
  { id: "ferramentas", label: "Ferramentas" },
  { id: "horas", label: "Horas extra" },
  { id: "outro", label: "Outro" },
] as const;
export type FolgaCategory = (typeof FOLGA_CATEGORIES)[number]["id"];

export const FOLGA_KINDS = ["folga", "cobrado"] as const;
/** folga = oferecido, sai da folga · cobrado = cobrado ao cliente, só registo. */
export type FolgaKind = (typeof FOLGA_KINDS)[number];

export type FolgaPerson = { username: string; name: string };

/** A que trabalho o extra corresponde (v78.40): uma tarefa do roadmap do
 *  cliente ou um ticket do Web. O rótulo é guardado como estava no dia —
 *  se a tarefa mudar de nome, o registo continua a dizer o que se lançou. */
export type FolgaLink = { kind: "task" | "ticket"; id: string; label: string };

export function folgaLinkHref(slug: string, link: FolgaLink): string {
  return link.kind === "ticket" ? `/web/tickets/${link.id}` : `/seo/${slug}/roadmap`;
}

export type FolgaEntry = {
  id: string;
  /** ISO yyyy-mm-dd — o dia do extra; o mês dele decide de que folga sai. */
  date: string;
  /** Sempre positivo, em euros com 2 casas. */
  eur: number;
  title: string;
  category: FolgaCategory;
  kind: FolgaKind;
  note: string | null;
  link: FolgaLink | null;
  by: FolgaPerson;
  at: number;
  voided: (FolgaPerson & { at: number; reason: string }) | null;
};

/** Uma mudança da folga mensal, a valer a partir de `from`. */
export type FolgaAllowance = { from: string; eur: number; by: FolgaPerson; at: number };

export type FolgaRecord = { allowances: FolgaAllowance[]; entries: FolgaEntry[] };

export const EMPTY_FOLGA: FolgaRecord = { allowances: [], entries: [] };

// ---------------------------------------------------------------------------
// Contas — sempre em cêntimos, para 76,67 × 12 não dar 920,0399999.
// ---------------------------------------------------------------------------

export const toCents = (eur: number) => Math.round(eur * 100);
export const fromCents = (c: number) => c / 100;

export const monthOf = (isoDate: string) => isoDate.slice(0, 7);

/** "2026-10" ± N meses. */
export function shiftFolgaMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A folga mensal de base (antes de qualquer mudança feita na página):
 *  a da tabela, 0 nos Lite, null quando ainda ninguém a definiu. */
export function baseAllowance(slug: string, tier: ClientTier | null): number | null {
  if (slug in FOLGA_DEFAULTS) return FOLGA_DEFAULTS[slug];
  if (tier === "lite") return 0;
  return null;
}

/** A folga que vale no mês `key`: a última mudança com `from` ≤ key, senão a base. */
export function allowanceFor(key: string, record: FolgaRecord, base: number | null): number | null {
  let value = base;
  for (const a of [...record.allowances].sort((x, y) => x.from.localeCompare(y.from) || x.at - y.at)) {
    if (a.from <= key) value = a.eur;
  }
  return value;
}

export type FolgaMonth = {
  key: string;
  /** Folga que entrou neste mês (cêntimos). */
  credit: number;
  /** Saldo com que o mês abriu — o que transitou do anterior (cêntimos). */
  opening: number;
  /** Oferecido: o que saiu da folga (cêntimos). */
  spent: number;
  /** Cobrado ao cliente — registo, não mexe no saldo (cêntimos). */
  charged: number;
  /** Saldo com que o mês fecha (ou o de hoje, no mês em curso). */
  closing: number;
};

export type FolgaState = "ok" | "low" | "out" | "over" | "lite" | "unset";

export type FolgaSummary = {
  months: FolgaMonth[];
  current: FolgaMonth;
  /** O que o mês em curso tinha para gastar: transitado + folga do mês. */
  available: number;
  /** O que ainda há (pode ser negativo). */
  remaining: number;
  /** 0–1+ — quanto do disponível já saiu. */
  used: number;
  allowanceNow: number | null;
  allowanceNext: number | null;
  nextKey: string;
  state: FolgaState;
  /** Oferecido por categoria, desde o início (cêntimos). */
  byCategory: Array<{ id: FolgaCategory; label: string; cents: number }>;
  totalOffered: number;
  totalCharged: number;
};

export function summarizeFolga(
  record: FolgaRecord,
  base: number | null,
  tier: ClientTier | null,
  nowKey: string,
): FolgaSummary {
  const live = record.entries.filter((e) => !e.voided);
  const firstEntry = live.map((e) => monthOf(e.date)).sort()[0];
  const start = firstEntry && firstEntry < FOLGA_START ? firstEntry : FOLGA_START;
  const months: FolgaMonth[] = [];
  let carry = 0;
  for (let key = start; key <= nowKey; key = shiftFolgaMonth(key, 1)) {
    const credit = key >= FOLGA_START ? toCents(allowanceFor(key, record, base) ?? 0) : 0;
    const inMonth = live.filter((e) => monthOf(e.date) === key);
    const spent = inMonth.filter((e) => e.kind === "folga").reduce((s, e) => s + toCents(e.eur), 0);
    const charged = inMonth.filter((e) => e.kind === "cobrado").reduce((s, e) => s + toCents(e.eur), 0);
    const closing = carry + credit - spent;
    months.push({ key, credit, opening: carry, spent, charged, closing });
    carry = closing;
  }
  const current = months[months.length - 1];
  const available = current.opening + current.credit;
  const remaining = current.closing;
  const allowanceNow = allowanceFor(nowKey, record, base);
  const nextKey = shiftFolgaMonth(nowKey, 1);
  const allowanceNext = allowanceFor(nextKey, record, base);

  let state: FolgaState;
  if (allowanceNow === null && remaining >= 0) state = "unset";
  else if (tier === "lite" && allowanceNow === 0 && available <= 0 && remaining >= 0) state = "lite";
  else if (remaining < 0) state = "over";
  else if (remaining === 0) state = "out";
  else if (available > 0 && remaining / available <= 0.2) state = "low";
  else state = "ok";

  const byCategory = FOLGA_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    cents: live.filter((e) => e.kind === "folga" && e.category === c.id).reduce((s, e) => s + toCents(e.eur), 0),
  }))
    .filter((c) => c.cents > 0)
    .sort((a, b) => b.cents - a.cents);

  return {
    months,
    current,
    available,
    remaining,
    used: available > 0 ? current.spent / available : current.spent > 0 ? 1 : 0,
    allowanceNow,
    allowanceNext,
    nextKey,
    state,
    byCategory,
    totalOffered: live.filter((e) => e.kind === "folga").reduce((s, e) => s + toCents(e.eur), 0),
    totalCharged: live.filter((e) => e.kind === "cobrado").reduce((s, e) => s + toCents(e.eur), 0),
  };
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

// de-DE: «1.695,00 €», com o ponto dos milhares — como as tabelas da direção.
const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** «76,67 €» a partir de cêntimos; o sinal de menos é o tipográfico. */
export function eurCents(c: number): string {
  return EUR.format(c / 100).replace("-", "−");
}

/** «outubro» */
export function folgaMonthName(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-PT", { month: "long", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1));
}

/** «OUT» */
export function folgaMonthShort(key: string): string {
  return folgaMonthName(key).slice(0, 3).toUpperCase();
}

export const FOLGA_STATE_LABEL: Record<FolgaState, string> = {
  ok: "Folga disponível",
  low: "A acabar",
  out: "Esgotada",
  over: "Acima da folga",
  lite: "Sem folga · Lite",
  unset: "Folga por definir",
};

export function categoryLabel(id: FolgaCategory): string {
  return FOLGA_CATEGORIES.find((c) => c.id === id)?.label ?? "Outro";
}
