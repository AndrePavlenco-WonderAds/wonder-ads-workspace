// O painel do PRÓPRIO consultor (v80.45) — a vista já pronta a desenhar:
// cada ocorrência (reportada por ele ou registada pela direção) com a
// autoavaliação do consultor ao lado da pontuação da direção, o estado na escala
// (a contar agora, por pontuar, de uma fase anterior, não contou), o porquê
// dos pontos quando a direção o mostra, o percurso na escala e a
// calibração «tu vs. direção».
//
// Recebe SEMPRE dados de `loadConsultantForSelf` (já sem a avaliação da
// direção nas ocorrências em que ela não mostrou o cálculo). Puro.

import {
  calcBreakdown,
  levelStepTitle,
  noticedLabel,
  reasonLabel,
  type CalcBreakdown,
  type IneficaciaErrorType,
  type IneficaciaImpact,
  type IneficaciaLedger,
  type IneficaciaNoticed,
  type IneficaciaReason,
  type IneficaciaReport,
  type IneficaciaScore,
  type LedgerState,
} from "./shared";

export type PanelStatus = "conta" | "pontuar" | "anterior" | "zero";

export type PanelEntry = {
  id: string;
  source: "report" | "direcao";
  reportId: string | null;
  reportRef: string | null;
  occurredOn: string;
  client: string;
  what: string;
  reason: string;
  noticed: string;
  firstTime: boolean | null;
  lastTime: string;
  shouldHave: string;
  /** A gravidade que o consultor deu (null nas da direção e nos antigos). */
  selfScore: number | null;
  score: Pick<IneficaciaScore, "points" | "byName" | "at" | "note"> | null;
  status: PanelStatus;
  /** O porquê dos pontos — só quando a direção o mostrou. */
  breakdown: CalcBreakdown | null;
};

export type JourneyItem = {
  at: string;
  kind: "subida" | "direcao" | "semestre" | "recuperado" | "medida";
  title: string;
  detail: string[];
};

export type Calibration = {
  /** Ocorrências com as duas pontuações (a tua e a da direção). */
  n: number;
  same: number;
  above: number;
  below: number;
  avgSelf: number;
  avgDir: number;
};

export type SelfPanel = {
  entries: PanelEntry[];
  journey: JourneyItem[];
  calibration: Calibration;
  counts: Record<PanelStatus | "todas", number> & { reportadas: number; direcao: number };
};

type Assessable = {
  reason: IneficaciaReason;
  firstTime: boolean | null;
  noticed: IneficaciaNoticed;
  errorType: IneficaciaErrorType | null;
  impacts: IneficaciaImpact[];
  showCalc: boolean;
  score: IneficaciaScore | null;
};

function breakdownOf(x: Assessable): CalcBreakdown | null {
  if (!x.showCalc || !x.errorType || !x.score || x.score.points === 0) return null;
  return calcBreakdown(
    { impacts: x.impacts, reason: x.reason, firstTime: x.firstTime, errorType: x.errorType, noticed: x.noticed },
    x.score.points,
  );
}

function statusOf(score: IneficaciaScore | null, countedNow: boolean): PanelStatus {
  if (!score) return "pontuar";
  if (score.points === 0) return "zero";
  return countedNow ? "conta" : "anterior";
}

function slimScore(s: IneficaciaScore | null): PanelEntry["score"] {
  return s ? { points: s.points, byName: s.byName, at: s.at, note: s.note } : null;
}

const MEASURE_TITLE: Record<1 | 2 | 3, string> = {
  1: "Medida do nível 1 aplicada: 1:1 com o líder direto",
  2: "Medida do nível 2 aplicada: 1:1 com o nível acima",
  3: "Probation iniciado (nível 3)",
};

export function buildSelfPanel(reports: IneficaciaReport[], ledger: IneficaciaLedger, state: LedgerState): SelfPanel {
  const countedNow = new Set(state.counted.map((o) => o.id));
  const entries: PanelEntry[] = [];

  for (const r of reports) {
    for (const it of r.items) {
      entries.push({
        id: it.id,
        source: "report",
        reportId: r.id,
        reportRef: r.ref,
        occurredOn: it.occurredOn,
        client: it.client,
        what: it.what,
        reason: reasonLabel(it.reason, it.reasonOther),
        noticed: noticedLabel(it.noticed),
        firstTime: it.firstTime,
        lastTime: it.lastTime,
        shouldHave: it.shouldHave,
        selfScore: it.selfScore,
        score: slimScore(it.score),
        status: statusOf(it.score, countedNow.has(it.id)),
        breakdown: breakdownOf(it),
      });
    }
  }
  for (const d of ledger.direct) {
    entries.push({
      id: d.id,
      source: "direcao",
      reportId: null,
      reportRef: null,
      occurredOn: d.occurredOn,
      client: d.client,
      what: d.what,
      reason: reasonLabel(d.reason, d.reasonOther),
      noticed: noticedLabel(d.noticed),
      firstTime: d.firstTime,
      lastTime: d.lastTime,
      shouldHave: d.shouldHave,
      selfScore: null,
      score: slimScore(d.score),
      status: statusOf(d.score, countedNow.has(d.id)),
      breakdown: breakdownOf(d),
    });
  }
  entries.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || (b.score?.at ?? 0) - (a.score?.at ?? 0));

  const journey: JourneyItem[] = [
    ...state.steps.map((st) => ({
      at: st.at,
      kind: st.reason,
      title: levelStepTitle(st),
      detail: st.pa !== undefined || st.no !== undefined ? [`Tinhas PA ${st.pa ?? 0} e NO ${st.no ?? 0}.`] : [],
    })),
    ...ledger.events
      .filter((e): e is Extract<typeof e, { kind: "measure" }> => e.kind === "measure")
      .map((e) => ({
        at: e.at,
        kind: "medida" as const,
        title: MEASURE_TITLE[e.level],
        detail: e.actions.filter((a) => a.trim()),
      })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const both = entries.filter((e) => e.selfScore !== null && e.score);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const calibration: Calibration = {
    n: both.length,
    same: both.filter((e) => e.score!.points === e.selfScore).length,
    above: both.filter((e) => e.score!.points > e.selfScore!).length,
    below: both.filter((e) => e.score!.points < e.selfScore!).length,
    avgSelf: both.length ? sum(both.map((e) => e.selfScore!)) / both.length : 0,
    avgDir: both.length ? sum(both.map((e) => e.score!.points)) / both.length : 0,
  };

  const by = (s: PanelStatus) => entries.filter((e) => e.status === s).length;
  return {
    entries,
    journey,
    calibration,
    counts: {
      todas: entries.length,
      conta: by("conta"),
      pontuar: by("pontuar"),
      anterior: by("anterior"),
      zero: by("zero"),
      reportadas: entries.filter((e) => e.source === "report").length,
      direcao: entries.filter((e) => e.source === "direcao").length,
    },
  };
}
