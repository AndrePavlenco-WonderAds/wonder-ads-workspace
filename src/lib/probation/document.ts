// O TEXTO do Plano de Probation — uma só fonte para a pré-visualização na
// app e para o PDF.
//
// O texto vem do protótipo revisto pela direção (PT-PT, tratamento por «tu»)
// e não se reescreve aqui: quem mudar uma frase muda-a neste ficheiro e as
// duas saídas acompanham. Os renderers só sabem desenhar; o que se diz está
// todo aqui.
//
// Um parágrafo é uma lista de segmentos:
//   "texto"                      → texto corrido
//   { b: "texto" }               → negrito
//   { bind, empty, strong? }     → valor do plano (nome, datas…); vazio, mostra
//                                  o marcador `empty` a cinzento, como o
//                                  protótipo
//   { fill, ph }                 → campo a preencher (dia do check-in,
//                                  prazo…); vazio, fica uma linha em branco
//                                  para escrever à mão no papel

import {
  DECISIONS,
  KPI_MET_OPTIONS,
  extensionDate,
  eval30Open,
  firstName,
  formatISODate,
  metCount,
  periodDates,
  type KpiMet,
  type ProbationDecision,
  type ProbationEvaluation,
  type ProbationKpi,
  type ProbationPeriod,
  type ProbationPlan,
} from "./shared";

export type Bind =
  | "consultor"
  | "primeiro"
  | "funcao"
  | "responsavel"
  | "direcao"
  | "d0"
  | "d15"
  | "d30";

export type Fill = "prazo" | "checkin" | "recursos" | "apoio" | "ferramenta";

export type Seg =
  | string
  | { b: string }
  | { bind: Bind; empty: string; strong?: boolean }
  | { fill: Fill; ph: string };

export type Para = Seg[];

const consultor = (empty: string, strong = false): Seg => ({ bind: "consultor", empty, strong });
const responsavel = (empty: string, strong = false): Seg => ({ bind: "responsavel", empty, strong });

export const BRAND = "WonderAds";

export const HERO = {
  eyebrow: "Plano de probation · 30 dias",
  title: consultor("[Nome do consultor]"),
  sub: [
    { bind: "funcao", empty: "[Função · Equipa]" },
    " · Responsável: ",
    responsavel("[Nome]"),
  ] as Para,
  tiles: [
    { label: "Início", bind: "d0" as Bind, small: "Dia 0" },
    { label: "1.ª avaliação", bind: "d15" as Bind, small: "Dia 15 · KPIs dos 15 dias" },
    { label: "2.ª avaliação", bind: "d30" as Bind, small: "Dia 30 · KPIs dos 30 dias" },
  ],
  dateEmpty: "dd/mm/aaaa",
};

export const S01 = {
  n: "01",
  title: "Dados do plano",
  rows: [
    { label: "Consultor", value: [consultor("[Nome completo]")] },
    { label: "Função e equipa", value: [{ bind: "funcao", empty: "[Função · Equipa]" }] },
    { label: "Responsável direto", value: [responsavel("[Nome do responsável]")] },
    { label: "Data de início", value: [{ bind: "d0", empty: "dd/mm/aaaa" }] },
    {
      label: "Avaliação dos 15 dias",
      value: [{ bind: "d15", empty: "dd/mm/aaaa" }, " (início + 15 dias)"],
    },
    {
      label: "Avaliação dos 30 dias",
      value: [{ bind: "d30", empty: "dd/mm/aaaa" }, " (início + 30 dias)"],
    },
  ] as { label: string; value: Para }[],
};

export const S02 = {
  n: "02",
  title: "Porquê este plano",
  paragraphs: [
    [
      { bind: "primeiro", empty: "[Nome]" },
      ", este plano existe porque queremos que fiques na equipa e que estejas ao nível que sabemos que consegues atingir. Não é uma formalidade nem um aviso disfarçado: é um acordo claro sobre o que tem de mudar, até quando, e como te vamos ajudar.",
    ],
    [
      "Nos próximos 30 dias vais ter objetivos concretos e mensuráveis. Há um primeiro conjunto de KPIs para cumprir até ao dia 15 e um segundo conjunto para cumprir até ao dia 30. Durante todo o período há acompanhamento: sentamo-nos contigo uma vez por semana, todas as semanas, para rever os números e desbloquear o que for preciso. Nas duas datas de avaliação olhamos para os resultados e tomamos uma decisão.",
    ],
  ] as Para[],
  note: {
    title: "O que queremos que fique claro desde já:",
    items: [
      [
        { b: "Sabes exatamente o que é esperado." },
        " Os KPIs estão escritos neste documento, com meta e forma de medição. Não há critérios escondidos.",
      ],
      [
        { b: "Sabes exatamente o que pode acontecer." },
        " Cada avaliação termina num de três desfechos, descritos na secção 05.",
      ],
      [
        { b: "Não estás sozinho." },
        " A secção 06 diz o que a WonderAds se compromete a fazer para te apoiar.",
      ],
      [
        { b: "A decisão baseia-se nos resultados." },
        " Avaliamos o que está escrito aqui, não impressões.",
      ],
    ] as Para[],
  },
};

/** Cabeçalho das tabelas de KPIs. A largura é a do protótipo; o «Cumprido»
 *  fica com o resto. */
export function kpiColumns(which: 15 | 30): { label: string; width: number | null }[] {
  return [
    { label: "#", width: null },
    { label: "KPI", width: 0.28 },
    { label: `Meta dia ${which}`, width: 0.15 },
    { label: "Como medimos", width: 0.15 },
    { label: "Resultado", width: 0.12 },
    { label: "Cumprido", width: null },
  ];
}

export const S03 = {
  n: "03",
  title: "KPIs para os primeiros 15 dias",
  intro: [
    "Estes são os objetivos que tens de cumprir até ",
    { bind: "d15", empty: "[data dos 15 dias]", strong: true },
    '. As colunas "Resultado" e "Cumprido" preenchem-se na reunião de avaliação.',
  ] as Para,
};

export const S04 = {
  n: "04",
  title: "KPIs para os 30 dias",
  intro: [
    "Estes são os objetivos que tens de cumprir até ",
    { bind: "d30", empty: "[data dos 30 dias]", strong: true },
    ". Contam os resultados acumulados desde a data de início, salvo indicação em contrário na meta.",
  ] as Para,
};

export const S05 = {
  n: "05",
  title: "Os três desfechos possíveis",
  intro: [
    "Cada avaliação, aos 15 e aos 30 dias, termina obrigatoriamente numa destas três decisões. Não há quarta opção nem decisões adiadas.",
  ] as Para,
  outcomes: [
    {
      id: "extensao" as ProbationDecision,
      k: "Opção 1",
      title: "Extensão do probation",
      color: "#343ed7",
      when: "Houve evolução real, mas os KPIs ainda não foram totalmente cumpridos.",
      what: "O probation prolonga-se por um período igual ao avaliado: mais 15 dias na avaliação dos 15 dias, mais 30 dias na dos 30. Os KPIs do novo período ficam escritos nesse mesmo dia.",
    },
    {
      id: "recuperacao" as ProbationDecision,
      k: "Opção 2",
      title: "Recuperação para a equipa",
      color: "#783df5",
      when: "Os KPIs foram cumpridos e o desempenho é consistente.",
      what: "O probation termina. Voltas ao funcionamento normal da equipa, sem reservas.",
    },
    {
      id: "saida" as ProbationDecision,
      k: "Opção 3",
      title: "Saída da equipa",
      color: "#c535c9",
      when: "Os KPIs não foram cumpridos e não há evolução que justifique uma extensão.",
      what: "Deixas a equipa. Os passos seguintes são explicados na reunião e confirmados por escrito, nos termos do teu contrato.",
    },
  ],
  whenLabel: "Quando se aplica",
  whatLabel: "O que acontece",
  note: [
    "A decisão é tomada por ",
    responsavel("[Responsável direto]", true),
    " e ",
    { bind: "direcao", empty: "[Direção]", strong: true },
    ", comunicada na reunião de avaliação e confirmada por escrito até ",
    { fill: "prazo", ph: "[24 horas]" },
    " depois. Qualquer que seja o desfecho, vais ouvi-lo primeiro de nós, cara a cara.",
  ] as Para,
  /** Sem chefia intermédia: decide a direção, sozinha. */
  noteSolo: [
    "A decisão é tomada pela Direção, ",
    { bind: "direcao", empty: "[Direção]", strong: true },
    ", comunicada na reunião de avaliação e confirmada por escrito até ",
    { fill: "prazo", ph: "[24 horas]" },
    " depois. Qualquer que seja o desfecho, vais ouvi-lo primeiro de nós, cara a cara.",
  ] as Para,
};

export const S06 = {
  n: "06",
  title: "Acompanhamento e apoio",
  intro: [
    "Um plano destes só é justo se vier com apoio a sério. Durante os 30 dias, a WonderAds compromete-se a:",
  ] as Para,
  ours: [
    [
      { b: "Check-in semanal de 30 minutos" },
      " com ",
      responsavel("[Responsável direto]"),
      ", às ",
      { fill: "checkin", ph: "[dia da semana]" },
      ", para rever números e desbloquear o que estiver a travar.",
    ],
    [
      { b: "Feedback rápido e direto." },
      " Se algo não está a correr bem, sabes na própria semana, não na avaliação.",
    ],
    [
      { b: "Recursos e formação:" },
      " ",
      { fill: "recursos", ph: "[formação, shadowing, ferramentas ou materiais específicos]" },
      ".",
    ],
    [
      { b: "Uma pessoa de apoio:" },
      " ",
      { fill: "apoio", ph: "[Nome]" },
      ", a quem podes recorrer no dia a dia para dúvidas.",
    ],
  ] as Para[],
  askIntro: ["Do teu lado, pedimos:"] as Para,
  theirs: [
    [
      "Que registes o teu trabalho em ",
      { fill: "ferramenta", ph: "[CRM / ferramenta]" },
      ", para os KPIs serem medidos sem discussão.",
    ],
    ["Que peças ajuda cedo. Um bloqueio partilhado no dia 3 resolve-se; no dia 14 já custa um KPI."],
    ["Que nos digas com franqueza se há algo, dentro ou fora do trabalho, a afetar o teu desempenho."],
  ] as Para[],
};

export const S07 = {
  n: "07",
  title: "Registo das avaliações",
  intro: [
    "Preenche-se em cada reunião, com o consultor presente. Os resultados por KPI ficam nas tabelas das secções 03 e 04.",
  ] as Para,
  evals: [
    { which: 15 as const, title: "Avaliação dos 15 dias", when: "d15" as Bind },
    { which: 30 as const, title: "Avaliação dos 30 dias", when: "d30" as Bind },
  ],
  labels: {
    met: "KPIs cumpridos",
    wentWell: "O que correu bem",
    fellShort: "O que ficou aquém",
    comment: "Comentário do consultor",
    decision: "Decisão",
    newDate: "Se extensão: nova data de avaliação",
    decidedBy: "Decisão tomada por",
  },
  metPh: { n: "[n]", total: "[total]", of: " de " },
  newDatePh: "dd/mm/aaaa",
  decidedByPh: "[Nome]",
  options: DECISIONS.map((d) => ({ id: d.id, label: `${d.n} · ${d.label}` })),
};

/** O fecho do documento. (v77.78: sai a secção 08 de confirmação e
 *  assinaturas — o probation não é uma opção do consultor, não há o que
 *  assinar. Fica só a nota de confidencialidade.) */
export const DOC_FOOT = [
  "WonderAds · Documento interno e confidencial",
  "Este plano é um instrumento interno de acompanhamento e não altera nem substitui o contrato em vigor.",
];

/* ------------- variantes «só direção» (sem chefia intermédia) ------------- */
// O texto acima é o do protótipo. Quando ainda não há chefia intermédia, a
// direção é o responsável direto: o `responsavel` passa a ser o nome da
// direção (no herói, no check-in da secção 06…) e só mudam as duas peças que
// diriam o mesmo nome duas vezes — a linha da secção 01 e a nota da 05.

export function infoRowsFor(model: Pick<DocModel, "soloDirection">): { label: string; value: Para }[] {
  if (!model.soloDirection) return S01.rows;
  return S01.rows.map((r) =>
    r.label === "Responsável direto"
      ? { label: r.label, value: [responsavel("[Direção]"), " (Direção)"] }
      : r,
  );
}

export function decisionNoteFor(model: Pick<DocModel, "soloDirection">): Para {
  return model.soloDirection ? S05.noteSolo : S05.note;
}

export const PAGE_FOOTER = "WonderAds · Plano de Probation · Documento interno e confidencial";

export const KPI_OPTIONS = KPI_MET_OPTIONS;

/* ------------------------- o modelo a desenhar --------------------- */

export type DocKpiRow = {
  kpi: string;
  target: string;
  measure: string;
  result: string;
  met: KpiMet | null;
};

export type DocEval = {
  /** «[n] de [total]» — vazios até haver um «Cumprido» marcado. */
  metN: string;
  metTotal: string;
  wentWell: string;
  fellShort: string;
  consultantComment: string;
  decision: ProbationDecision | null;
  /** dd/mm/aaaa quando a decisão é extensão; "—" noutra decisão; "" sem
   *  decisão (linha em branco). */
  newDate: string;
  decidedBy: string;
  /** A avaliação dos 30 não se aplica (o plano fechou aos 15). */
  notApplicable: boolean;
};

export type DocModel = {
  /** Template em branco — para imprimir e preencher à mão. */
  blank: boolean;
  /** Sem chefia intermédia: a direção acompanha e decide sozinha. */
  soloDirection: boolean;
  /** «2.º período» depois de uma extensão aos 30 dias; null no primeiro. */
  periodLabel: string | null;
  binds: Record<Bind, string>;
  fills: Record<Fill, string>;
  kpis15: DocKpiRow[];
  kpis30: DocKpiRow[];
  eval15: DocEval;
  eval30: DocEval;
};

/** Linhas vazias de uma tabela de KPIs sem KPIs (template em branco, ou um
 *  plano a meio de escrever): três, como o protótipo. */
const BLANK_KPI_ROWS = 3;

function blankRows(): DocKpiRow[] {
  return Array.from({ length: BLANK_KPI_ROWS }, () => ({
    kpi: "",
    target: "",
    measure: "",
    result: "",
    met: null,
  }));
}

function kpiRows(kpis: ProbationKpi[]): DocKpiRow[] {
  const rows = kpis
    .map((k) => ({
      kpi: k.kpi.trim(),
      target: k.target.trim(),
      measure: k.measure.trim(),
      result: k.result.trim(),
      met: k.met,
    }))
    .filter((r) => r.kpi || r.target || r.measure || r.result || r.met);
  return rows.length ? rows : blankRows();
}

function evalModel(
  e: ProbationEvaluation,
  kpis: ProbationKpi[],
  newDate: string,
  notApplicable: boolean,
): DocEval {
  const c = metCount(kpis);
  return {
    metN: c.recorded ? String(c.met) : "",
    metTotal: c.recorded ? String(c.total) : "",
    wentWell: e.wentWell.trim(),
    fellShort: e.fellShort.trim(),
    consultantComment: e.consultantComment.trim(),
    decision: e.decision,
    newDate: e.decision === "extensao" ? formatISODate(newDate) : e.decision ? "—" : "",
    decidedBy: e.decidedBy.trim(),
    notApplicable,
  };
}

function emptyEval(): DocEval {
  return {
    metN: "",
    metTotal: "",
    wentWell: "",
    fellShort: "",
    consultantComment: "",
    decision: null,
    newDate: "",
    decidedBy: "",
    notApplicable: false,
  };
}

type PlanFields = Pick<
  ProbationPlan,
  | "consultantName"
  | "roleTeam"
  | "hasManager"
  | "manager"
  | "direction"
  | "checkinDay"
  | "resources"
  | "supportPerson"
  | "trackingTool"
  | "confirmationDeadline"
>;

/** O documento de um período de um plano. `periodIndex` é 0 para o
 *  primeiro período. */
export function buildDocModel(
  plan: PlanFields,
  period: ProbationPeriod,
  periodIndex: number,
): DocModel {
  const { d0, d15, d30 } = periodDates(period);
  const name = plan.consultantName.trim();
  const closedAt15 = Boolean(period.eval15.decision) && !eval30Open(period);
  const solo = !plan.hasManager;
  return {
    blank: false,
    soloDirection: solo,
    periodLabel: periodIndex > 0 ? `${periodIndex + 1}.º período` : null,
    binds: {
      consultor: name,
      primeiro: firstName(name),
      funcao: plan.roleTeam.trim(),
      // Sem chefia intermédia, o responsável direto é a direção.
      responsavel: (solo ? plan.direction : plan.manager).trim(),
      direcao: plan.direction.trim(),
      d0: formatISODate(d0),
      d15: formatISODate(d15),
      d30: formatISODate(d30),
    },
    fills: {
      prazo: plan.confirmationDeadline.trim(),
      checkin: plan.checkinDay.trim(),
      recursos: plan.resources.trim(),
      apoio: plan.supportPerson.trim(),
      ferramenta: plan.trackingTool.trim(),
    },
    kpis15: kpiRows(period.kpis15),
    kpis30: kpiRows(period.kpis30),
    eval15: evalModel(period.eval15, period.kpis15, extensionDate(period, 15), false),
    eval30: closedAt15
      ? { ...emptyEval(), notApplicable: true }
      : evalModel(period.eval30, period.kpis30, extensionDate(period, 30), false),
  };
}

export function blankDocModel(): DocModel {
  const empty = <K extends string>(keys: K[]) =>
    Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>;
  return {
    blank: true,
    soloDirection: false,
    periodLabel: null,
    binds: empty<Bind>(["consultor", "primeiro", "funcao", "responsavel", "direcao", "d0", "d15", "d30"]),
    fills: empty<Fill>(["prazo", "checkin", "recursos", "apoio", "ferramenta"]),
    kpis15: blankRows(),
    kpis30: blankRows(),
    eval15: emptyEval(),
    eval30: emptyEval(),
  };
}

/** «Plano de Probation - <consultor>.pdf». Tira só o que os sistemas de
 *  ficheiros não aceitam; os acentos ficam. */
export function pdfFileName(consultantName: string | null, periodLabel?: string | null): string {
  const clean = (consultantName ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const who = clean || "Em branco";
  return periodLabel ? `Plano de Probation - ${who} (${periodLabel}).pdf` : `Plano de Probation - ${who}.pdf`;
}
