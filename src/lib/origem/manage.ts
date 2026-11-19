// Origem de Pacientes — apagar, reset e histórico (v80.4). Puro: tipos e
// palavras partilhados entre o servidor e o browser.

export type OrigemPeriod = "today" | "month" | "all";

export const PERIOD_LABEL: Record<OrigemPeriod, string> = {
  today: "Hoje",
  month: "Este mês",
  all: "Desde o início",
};

/** Uma ação do histórico, como o ecrã a mostra (sem as linhas guardadas). */
export type OrigemActionView = {
  id: string;
  kind: "delete" | "reset";
  at: number;
  byName: string;
  period: OrigemPeriod | null;
  /** null = todos os locais. */
  site: string | null;
  count: number;
  /** Quantos registos por local e por origem. */
  sites: Record<string, number>;
  sources: Record<string, number>;
  /** O registo apagado (só nos «delete»). */
  vote: { site: string; source: string; channel: string | null; at: number } | null;
  revertedAt: number | null;
  revertedByName: string | null;
};

export const isPeriod = (v: unknown): v is OrigemPeriod => v === "today" || v === "month" || v === "all";
