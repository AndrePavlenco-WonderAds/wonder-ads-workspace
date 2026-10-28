// Bónus semestral (v78.30) — as regras e as contas. Módulo PURO: a página
// junta as ocorrências de cada pessoa e isto devolve o semestre, o NO, o PA
// e o escalão. As mesmas constantes desenham a tabela da página.
//
// Regras (André, 2026-10-28):
//   • Dois semestres por ano: janeiro a junho (avaliado em junho) e julho a
//     dezembro (avaliado em dezembro).
//   • NO = ineficácias pontuadas (> 0) com data no semestre; PA = a soma dos
//     pontos. Ao contrário da escala, o 1:1 de nível NÃO põe isto a zero.
//   • 0–2 NO e 0–9 PA → 500 € · 3–4 NO ou 10–15 PA → 300 € · 5–6 NO ou
//     16–20 PA → 150 € · 7+ NO ou 21+ PA → 0 € (valores revistos na v78.33;
//     eram 600/400/200).
//   • Conta o pior dos dois: para ficar num escalão é preciso cumprir os
//     dois limites (o mesmo «ou» da escala de ineficácias, onde basta um
//     contador passar para subir).

import { counts, type Occurrence } from "@/lib/ineficacias/shared";

export type SemesterTier = {
  eur: number;
  /** O máximo de NO e de PA deste escalão (null = sem teto). */
  maxNo: number | null;
  maxPa: number | null;
};

/** Do melhor para o pior — o primeiro em que cabem os dois fica. */
export const SEMESTER_TIERS: SemesterTier[] = [
  { eur: 500, maxNo: 2, maxPa: 9 },
  { eur: 300, maxNo: 4, maxPa: 15 },
  { eur: 150, maxNo: 6, maxPa: 20 },
  { eur: 0, maxNo: null, maxPa: null },
];

export function tierForSemester(no: number, pa: number): SemesterTier {
  return (
    SEMESTER_TIERS.find((t) => (t.maxNo === null || no <= t.maxNo) && (t.maxPa === null || pa <= t.maxPa)) ??
    SEMESTER_TIERS[SEMESTER_TIERS.length - 1]
  );
}

/** «0 a 2» · «3 a 4» · «7 ou mais» — o intervalo de um escalão. */
export function tierRange(i: number, which: "no" | "pa"): string {
  const t = SEMESTER_TIERS[i];
  const prev = SEMESTER_TIERS[i - 1];
  const from = prev ? (which === "no" ? prev.maxNo! : prev.maxPa!) + 1 : 0;
  const to = which === "no" ? t.maxNo : t.maxPa;
  return to === null ? `${from} ou mais` : `${from} a ${to}`;
}

export type Semester = {
  /** «2026-H2». */
  key: string;
  /** YYYY-MM-DD, inclusive. */
  start: string;
  end: string;
  /** «2.º semestre de 2026». */
  label: string;
  /** «julho a dezembro». */
  months: string;
  /** «dezembro» — o mês em que é avaliado. */
  evaluatedIn: string;
};

export function semesterOf(iso: string): Semester {
  const year = Number(iso.slice(0, 4));
  const first = Number(iso.slice(5, 7)) <= 6;
  return first
    ? { key: `${year}-H1`, start: `${year}-01-01`, end: `${year}-06-30`, label: `1.º semestre de ${year}`, months: "janeiro a junho", evaluatedIn: "junho" }
    : { key: `${year}-H2`, start: `${year}-07-01`, end: `${year}-12-31`, label: `2.º semestre de ${year}`, months: "julho a dezembro", evaluatedIn: "dezembro" };
}

export type SemesterTally = { no: number; pa: number; unscored: number; tier: SemesterTier };

/** O NO e o PA de uma pessoa no semestre, até `todayISO`. */
export function tallySemester(occurrences: Occurrence[], semester: Semester, todayISO: string): SemesterTally {
  const upTo = todayISO < semester.end ? todayISO : semester.end;
  const inside = occurrences.filter((o) => o.occurredOn >= semester.start && o.occurredOn <= upTo);
  const scored = inside.filter(counts);
  const no = scored.length;
  const pa = scored.reduce((s, o) => s + (o.score?.points ?? 0), 0);
  return { no, pa, unscored: inside.filter((o) => !o.score).length, tier: tierForSemester(no, pa) };
}
