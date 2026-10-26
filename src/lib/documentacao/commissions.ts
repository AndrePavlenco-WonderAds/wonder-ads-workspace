// Comissões da equipa de Delivery (v78.5) — as regras e as contas.
//
// Fonte das regras: «Renovações — Programa de Crescimento Orgânico»,
// outubro 2026. Módulo PURO: as tabelas da página e o tracking (que lê as
// propostas aceites do COMMERCIAL DPT) usam as mesmas constantes.
//
//   • Renovação: 3% fixos, sempre.
//   • Cross-sell / upsell: a % do patamar em que o consultor está NO MOMENTO
//     em que fecha — o acumulado ANTES deste negócio decide. Não é retroativa.
//   • Tudo (renovações incluídas) soma ao acumulado, que é individual.

export const RENEWAL_RATE = 0.03;

export type CommissionTier = {
  n: number;
  /** Acumulado a partir do qual o patamar vale (inclusive), sem IVA. */
  from: number;
  /** Até onde vai (exclusive); null = sem teto. */
  to: number | null;
  rate: number;
};

export const COMMISSION_TIERS: CommissionTier[] = [
  { n: 1, from: 0, to: 25_000, rate: 0.05 },
  { n: 2, from: 25_000, to: 50_000, rate: 0.06 },
  { n: 3, from: 50_000, to: 75_000, rate: 0.07 },
  { n: 4, from: 75_000, to: null, rate: 0.08 },
];

/** Os fechos contam a partir daqui — o arranque do sistema novo. */
export const COMMISSIONS_START = "2026-10-01";

export function tierForAccumulated(acc: number): CommissionTier {
  return [...COMMISSION_TIERS].reverse().find((t) => acc >= t.from) ?? COMMISSION_TIERS[0];
}

export type DealKind = "renovacao" | "cross-sell";

export type DealInput = {
  slug: string;
  clientName: string;
  title: string;
  kind: DealKind;
  /** Valor sem IVA; null = a proposta não tem valor. */
  value: number | null;
  /** true quando o valor foi estimado a partir do texto da proposta. */
  estimated: boolean;
  /** Dia do fecho (ISO yyyy-mm-dd). */
  closedOn: string;
};

export type DealLine = DealInput & {
  /** Acumulado antes deste negócio. */
  accBefore: number;
  tier: CommissionTier;
  rate: number;
  commission: number;
};

export type ConsultantCommissions = {
  username: string | null;
  name: string;
  deals: DealLine[];
  accumulated: number;
  tier: CommissionTier;
  /** Quanto falta para o próximo patamar; null no último. */
  toNext: number | null;
  totalCommission: number;
  withoutValue: number;
};

/** Corre os fechos de UM consultor por ordem cronológica. */
export function computeConsultantCommissions(
  who: { username: string | null; name: string },
  deals: DealInput[],
): ConsultantCommissions {
  const ordered = [...deals].sort((a, b) => a.closedOn.localeCompare(b.closedOn));
  let acc = 0;
  const lines: DealLine[] = ordered.map((d) => {
    const tier = tierForAccumulated(acc);
    const rate = d.kind === "renovacao" ? RENEWAL_RATE : tier.rate;
    const value = d.value ?? 0;
    const line: DealLine = { ...d, accBefore: acc, tier, rate, commission: value * rate };
    acc += value;
    return line;
  });
  const tier = tierForAccumulated(acc);
  return {
    username: who.username,
    name: who.name,
    deals: lines.reverse(),
    accumulated: acc,
    tier,
    toNext: tier.to === null ? null : tier.to - acc,
    totalCommission: lines.reduce((n, l) => n + l.commission, 0),
    withoutValue: lines.filter((l) => l.value === null).length,
  };
}

/** «3%», «5%». */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** «427,50 €» — com cêntimos, para comissões. */
export function formatEurCents(n: number): string {
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
