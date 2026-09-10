// Valor de uma proposta em euros — o número que o pódio do Comercial pesa.
//
// O investimento escrito no cartão é texto («6.000 € mensal · 5.400 €
// pré-pago», «700 € + IVA») e serve para ler, não para somar. O valor que
// conta para o pódio é um número: o TOTAL do contrato sem IVA — avença
// mensal × meses do período, ou o preço único de um serviço. Vem, por
// ordem: do que o Comercial escreveu por cima (KV), do registo (código ou
// upload) e, em último recurso, de uma estimativa a partir do texto — que o
// cartão marca como «estimado» para alguém confirmar.
//
// Módulo puro (sem servidor) — o cartão no browser também formata.

/** «36.000 €» — o estilo do resto da app (ponto nos milhares). */
export function formatEur(n: number): string {
  return `${Math.round(n).toLocaleString("de-DE")} €`;
}

const MONTHS_PT = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function plain(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function monthIndex(token: string): number | null {
  const t = plain(token).replace(/\.$/, "");
  const full = MONTHS_PT.indexOf(t);
  if (full >= 0) return full;
  if (t.length === 3) {
    const abbr = MONTHS_PT.findIndex((m) => m.startsWith(t));
    if (abbr >= 0) return abbr;
  }
  return null;
}

/** «Setembro 2026 – Fevereiro 2027» → 6; «Set 2026 – Fev 2027» → 6. null
 *  quando não há dois «mês ano» reconhecíveis. */
export function monthsInPeriod(period: string): number | null {
  const re = /([a-zA-Zà-úÀ-Ú]{3,9})\.?\s*(?:de\s+)?(\d{4})/g;
  const hits: Array<{ m: number; y: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(period)) && hits.length < 2) {
    const m = monthIndex(match[1]);
    if (m === null) continue;
    hits.push({ m, y: Number(match[2]) });
  }
  if (hits.length < 2) return null;
  const n = (hits[1].y - hits[0].y) * 12 + (hits[1].m - hits[0].m) + 1;
  return n >= 1 && n <= 60 ? n : null;
}

/** Primeiro montante em euros no texto: «6.000 € mensal · 5.400 € pré-pago»
 *  → 6000; «700 € + IVA» → 700; «€ 1.250,50» → 1250.5. null sem montante. */
export function firstAmountEur(text: string): number | null {
  const num = "(\\d{1,3}(?:[.\\u00a0 ]\\d{3})+|\\d+)(?:,(\\d{1,2}))?";
  const after = new RegExp(`${num}\\s*(?:€|eur(?:os?)?\\b)`, "i").exec(text);
  const before = new RegExp(`€\\s*${num}`, "i").exec(text);
  const pick = after && before ? (after.index <= before.index ? after : before) : after ?? before;
  if (!pick) return null;
  const int = pick[1].replace(/[.  ]/g, "");
  const dec = pick[2] ?? "";
  const n = Number(dec ? `${int}.${dec}` : int);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Estimativa do valor total a partir do texto: montante × meses quando é
 *  uma avença mensal e o período se percebe; senão o montante tal como
 *  está. É a rede para propostas sem valor escrito — nunca a fonte
 *  preferida. */
export function estimateValueEur(investment: string, period: string): number | null {
  const amount = firstAmountEur(investment);
  if (amount === null) return null;
  const monthly = /mensal|mensais|\/\s*m[êe]s|por\s+m[êe]s|ao\s+m[êe]s/i.test(investment);
  if (!monthly) return amount;
  const months = monthsInPeriod(period);
  return months ? amount * months : amount;
}

/** Normaliza um valor vindo de um formulário ou da API: número finito,
 *  ≥ 0, arredondado aos cêntimos, com teto de sanidade. null = sem valor. */
export function sanitizeValueEur(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10_000_000) return undefined;
  return Math.round(v * 100) / 100;
}
