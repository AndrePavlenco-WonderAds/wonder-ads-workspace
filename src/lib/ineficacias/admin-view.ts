// A vista da DIREÇÃO sobre um consultor (v80.50) — pronta a desenhar:
//   • cada ocorrência (do relatório ou da direção) numa entrada única, com o
//     estado na escala (a contar agora, por pontuar, fase anterior, não
//     contou), o alvo da pontuação e a base da calculadora;
//   • as POR PONTUAR com «o passado que interessa»: as outras ocorrências do
//     mesmo cliente, do mesmo motivo e as parecidas (palavras em comum), para
//     decidir a pontuação sem andar à procura nos relatórios;
//   • o percurso na escala (subidas, resets, medidas, nível à mão) para o
//     histórico cronológico.
// Puro. Só para páginas da direção — leva a avaliação da direção inteira.

import { normalize, stem } from "@/lib/documentacao/search";
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

export type AdminStatus = "conta" | "pontuar" | "anterior" | "zero";

export type ScoreTarget = { reportId: string; itemId: string } | { username: string; occurrenceId: string };

export type AdminEntry = {
  id: string;
  source: "report" | "direcao";
  reportId: string | null;
  reportRef: string | null;
  /** Quando o relatório foi assinado (só nas reportadas). */
  reportedOn: string | null;
  occurredOn: string;
  client: string;
  what: string;
  shouldHave: string;
  reasonId: IneficaciaReason;
  reason: string;
  noticedId: IneficaciaNoticed;
  noticed: string;
  firstTime: boolean | null;
  lastTime: string;
  /** A gravidade que o consultor deu (null nas da direção e nos antigos). */
  selfScore: number | null;
  score: IneficaciaScore | null;
  status: AdminStatus;
  /** Conta na fase corrente quando for pontuada (> 0)? */
  inPhase: boolean;
  target: ScoreTarget;
  calc: {
    reason: IneficaciaReason;
    firstTime: boolean | null;
    noticed: IneficaciaNoticed;
    errorType: IneficaciaErrorType | null;
    impacts: IneficaciaImpact[];
    showCalc: boolean;
  };
  /** As parcelas da calculadora (a direção vê-as sempre que existam). */
  breakdown: CalcBreakdown | null;
};

export type RelatedTag = "cliente" | "motivo" | "parecida";

export type RelatedEntry = { entry: AdminEntry; tags: RelatedTag[] };

export type PendingDesk = {
  entry: AdminEntry;
  /** As mais relevantes (até 4), da mais parecida para a menos. */
  related: RelatedEntry[];
  /** Quantas outras ocorrências há no histórico, ao todo. */
  others: number;
  sameClient: number;
  sameReason: number;
  similar: number;
};

export type JourneyItem = {
  at: string;
  kind: "subida" | "direcao" | "semestre" | "recuperado" | "medida" | "nivel";
  title: string;
  detail: string[];
  by: string | null;
};

export type AdminView = {
  entries: AdminEntry[];
  pending: PendingDesk[];
  journey: JourneyItem[];
  counts: Record<AdminStatus | "todas", number>;
  clients: string[];
};

/* ------------------------------------------------------------------ */

function statusOf(score: IneficaciaScore | null, countedNow: boolean): AdminStatus {
  if (!score) return "pontuar";
  if (score.points === 0) return "zero";
  return countedNow ? "conta" : "anterior";
}

function breakdownOf(x: AdminEntry["calc"], score: IneficaciaScore | null): CalcBreakdown | null {
  if (!x.errorType || !score || score.points === 0) return null;
  return calcBreakdown(
    { impacts: x.impacts, reason: x.reason, firstTime: x.firstTime, errorType: x.errorType, noticed: x.noticed },
    score.points,
  );
}

/* Palavras que aparecem em quase todos os relatos — não dizem nada sobre o
   erro em si. */
const NOISE = new Set(
  (
    "cliente clientes erro erros porque quando depois antes ainda tinha estava ficou nao sido fazer feito fiz " +
    "entre tambem muito pouco sobre essa esse isso este esta estes estas para pelo pela pelos pelas como mais " +
    "menos sem com mas foi foram ser estar tive teve havia sobre onde qual quais todo toda todos todas outro " +
    "outra outros outras dia dias vez vezes semana mes hoje ontem amanha apenas so ja tudo nada algo alguma"
  ).split(" "),
);

function keywords(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of normalize(text).split(" ")) {
    if (w.length < 4 || NOISE.has(w) || /^\d+$/.test(w)) continue;
    out.add(stem(w));
  }
  return out;
}

/** Parecidas: pelo menos 2 palavras com significado em comum e um terço das
 *  palavras do relato mais curto. */
function similar(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.34;
}

const MEASURE_TITLE: Record<1 | 2 | 3, string> = {
  1: "Medida do nível 1 aplicada: 1:1 com o líder direto",
  2: "Medida do nível 2 aplicada: 1:1 com o nível acima",
  3: "Probation iniciado (nível 3)",
};

export function buildAdminView(
  username: string,
  reports: IneficaciaReport[],
  ledger: IneficaciaLedger,
  state: LedgerState,
): AdminView {
  const countedNow = new Set(state.counted.map((o) => o.id));
  const phaseFrom = state.phaseOpen?.at ?? null;
  const inPhase = (d: string) => phaseFrom === null || d > phaseFrom;
  const entries: AdminEntry[] = [];

  for (const r of reports) {
    for (const it of r.items) {
      const calc = {
        reason: it.reason,
        firstTime: it.firstTime,
        noticed: it.noticed,
        errorType: it.errorType,
        impacts: it.impacts,
        showCalc: it.showCalc,
      };
      entries.push({
        id: it.id,
        source: "report",
        reportId: r.id,
        reportRef: r.ref,
        reportedOn: r.submittedOn,
        occurredOn: it.occurredOn,
        client: it.client,
        what: it.what,
        shouldHave: it.shouldHave,
        reasonId: it.reason,
        reason: reasonLabel(it.reason, it.reasonOther),
        noticedId: it.noticed,
        noticed: noticedLabel(it.noticed),
        firstTime: it.firstTime,
        lastTime: it.lastTime,
        selfScore: it.selfScore,
        score: it.score,
        status: statusOf(it.score, countedNow.has(it.id)),
        inPhase: inPhase(it.occurredOn),
        target: { reportId: r.id, itemId: it.id },
        calc,
        breakdown: breakdownOf(calc, it.score),
      });
    }
  }
  for (const d of ledger.direct) {
    const calc = {
      reason: d.reason,
      firstTime: d.firstTime,
      noticed: d.noticed,
      errorType: d.errorType,
      impacts: d.impacts,
      showCalc: d.showCalc,
    };
    entries.push({
      id: d.id,
      source: "direcao",
      reportId: null,
      reportRef: null,
      reportedOn: null,
      occurredOn: d.occurredOn,
      client: d.client,
      what: d.what,
      shouldHave: d.shouldHave,
      reasonId: d.reason,
      reason: reasonLabel(d.reason, d.reasonOther),
      noticedId: d.noticed,
      noticed: noticedLabel(d.noticed),
      firstTime: d.firstTime,
      lastTime: d.lastTime,
      selfScore: null,
      score: d.score,
      status: statusOf(d.score, countedNow.has(d.id)),
      inPhase: inPhase(d.occurredOn),
      target: { username, occurrenceId: d.id },
      calc,
      breakdown: breakdownOf(calc, d.score),
    });
  }
  entries.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || (b.score?.at ?? 0) - (a.score?.at ?? 0));

  // O passado de cada ocorrência por pontuar.
  const words = new Map(entries.map((e) => [e.id, keywords(e.what)]));
  const pending: PendingDesk[] = entries
    .filter((e) => e.status === "pontuar")
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
    .map((e) => {
      const mine = words.get(e.id)!;
      const others = entries.filter((o) => o.id !== e.id);
      const tagged = others.map((o) => {
        const tags: RelatedTag[] = [];
        if (similar(mine, words.get(o.id)!)) tags.push("parecida");
        if (o.client === e.client) tags.push("cliente");
        if (o.reasonId === e.reasonId) tags.push("motivo");
        return { entry: o, tags };
      });
      const weight = (t: RelatedTag[]) =>
        (t.includes("parecida") ? 4 : 0) + (t.includes("cliente") ? (e.client === "Interno" ? 1 : 2) : 0) + (t.includes("motivo") ? 1 : 0);
      const related = tagged
        .filter((x) => x.tags.length > 0)
        .sort((a, b) => weight(b.tags) - weight(a.tags) || b.entry.occurredOn.localeCompare(a.entry.occurredOn))
        .slice(0, 4);
      return {
        entry: e,
        related,
        others: others.length,
        sameClient: tagged.filter((x) => x.tags.includes("cliente")).length,
        sameReason: tagged.filter((x) => x.tags.includes("motivo")).length,
        similar: tagged.filter((x) => x.tags.includes("parecida")).length,
      };
    });

  const journey: JourneyItem[] = [
    ...state.steps
      .filter((st) => st.reason !== "direcao")
      .map((st) => ({
        at: st.at,
        kind: st.reason,
        title: levelStepTitle(st),
        detail: st.pa !== undefined || st.no !== undefined ? [`Tinha PA ${st.pa ?? 0} e NO ${st.no ?? 0}.`] : [],
        by: null,
      })),
    ...ledger.events.map((e) =>
      e.kind === "measure"
        ? {
            at: e.at,
            kind: "medida" as const,
            title: MEASURE_TITLE[e.level],
            detail: [
              ...(e.conductedBy ? [`Conduziu: ${e.conductedBy}`] : []),
              ...e.actions.filter((a) => a.trim()),
              ...(e.note ? [e.note] : []),
            ],
            by: e.byName || e.by,
          }
        : {
            at: e.at,
            kind: "nivel" as const,
            title: `Nível definido à mão: ${e.level}`,
            detail: e.note ? [e.note] : [],
            by: e.byName || e.by,
          },
    ),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const by = (s: AdminStatus) => entries.filter((e) => e.status === s).length;
  return {
    entries,
    pending,
    journey,
    counts: { todas: entries.length, conta: by("conta"), pontuar: by("pontuar"), anterior: by("anterior"), zero: by("zero") },
    clients: [...new Set(entries.map((e) => e.client))].sort((a, b) => a.localeCompare(b, "pt")),
  };
}
