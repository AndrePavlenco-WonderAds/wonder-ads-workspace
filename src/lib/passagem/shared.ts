// Passagem de consultor (v80.39) — o offboarding de um consultor SEO, projeto
// a projeto, ao longo de 30 dias.
//
// Módulo PURO (servidor e browser): os tipos, o que a ficha de cada projeto
// pede, os acessos a garantir, as fases dos 30 dias, a checklist de saída da
// direção e as contas do progresso. As páginas, as APIs, o menu e o sino leem
// daqui — a regra escrita e a calculada são a mesma linha.
//
// Como as agências fazem (o que isto copia):
//   • uma ficha de passagem por cliente, escrita por quem sai: estado,
//     objetivos, pessoas, próximos passos, histórico, riscos;
//   • inventário de acessos ANTES de a pessoa sair — tudo na conta da
//     agência ou no cofre do cliente, nada só no email de quem sai;
//   • apresentação «a quente»: uma reunião a três (quem sai, quem entra e o
//     cliente) e o cliente avisado por quem ele já conhece;
//   • quem entra assina que leu e assume — a passagem só fecha aí;
//   • checklist de saída da pessoa (grupos, documentos, ferramentas, conta).

export const PASSAGEM_DAYS = 30;

export type Person = { username: string; name: string };

/* ------------------------------------------------------------------ */
/*  Passagem (o processo)                                              */
/* ------------------------------------------------------------------ */

export type PassagemReason = "saida" | "mudanca" | "licenca" | "outro";

export const PASSAGEM_REASONS: Array<{ id: PassagemReason; label: string }> = [
  { id: "saida", label: "Sai da WonderAds" },
  { id: "mudanca", label: "Muda de função ou de equipa" },
  { id: "licenca", label: "Licença prolongada" },
  { id: "outro", label: "Outro motivo" },
];

export function reasonLabel(r: PassagemReason): string {
  return PASSAGEM_REASONS.find((x) => x.id === r)?.label ?? "Outro motivo";
}

export type PassagemStatus = "ativa" | "concluida" | "cancelada";

export type PassagemProjectRef = {
  slug: string;
  title: string;
  /** Quem fica com o projeto; null enquanto a direção não decide. */
  incoming: Person | null;
};

export type ExitItemId =
  | "equipa"
  | "grupos"
  | "documentos"
  | "ferramentas"
  | "passwords"
  | "email"
  | "conta"
  | "conversa";

export type ExitItem = { id: ExitItemId; label: string; hint: string; onlyWhenLeaving?: boolean };

/** A checklist da direção. Os itens `onlyWhenLeaving` só aparecem quando a
 *  pessoa sai da empresa (numa mudança de equipa continua a precisar da
 *  conta e do email). Sem «equipamento»: a WonderAds não dá equipamento
 *  (André, 24/11/2026). */
export const EXIT_CHECKLIST: ExitItem[] = [
  { id: "equipa", label: "Equipa avisada", hint: "Quem sai, quando e quem fica com cada projeto." },
  {
    id: "grupos",
    label: "Fora dos grupos dos clientes",
    hint: "WhatsApp e Slack de cada cliente, depois de o novo consultor já lá estar.",
  },
  {
    id: "documentos",
    label: "Documentos passados",
    hint: "Pastas da Drive, Docs, Sheets e gravações do Fathom na conta da agência ou do novo consultor.",
  },
  {
    id: "ferramentas",
    label: "Utilizador pessoal fora das ferramentas",
    hint: "Search Console, Analytics, Business Profile, WordPress, Semrush, SE Ranking.",
  },
  {
    id: "passwords",
    label: "Passwords partilhadas mudadas",
    hint: "As que a pessoa conhecia e não são do cliente.",
    onlyWhenLeaving: true,
  },
  {
    id: "email",
    label: "Email de trabalho reencaminhado",
    hint: "Para o novo consultor ou para seo@, com resposta automática.",
    onlyWhenLeaving: true,
  },
  { id: "conta", label: "Conta na app desativada", hint: "No último dia.", onlyWhenLeaving: true },
  {
    id: "conversa",
    label: "Conversa de saída feita",
    hint: "O que correu bem e o que mudar — fica como aprendizagem.",
    onlyWhenLeaving: true,
  },
];

export function exitItemsFor(reason: PassagemReason): ExitItem[] {
  return reason === "saida" ? EXIT_CHECKLIST : EXIT_CHECKLIST.filter((i) => !i.onlyWhenLeaving);
}

export type Passagem = {
  id: string;
  outgoing: Person;
  reason: PassagemReason;
  /** yyyy-mm-dd (Lisboa). */
  startDate: string;
  /** yyyy-mm-dd — por defeito o início + 29 dias (30 dias contados). */
  endDate: string;
  /** Nota da direção para quem sai (aparece no topo da página dele). */
  note: string;
  status: PassagemStatus;
  projects: PassagemProjectRef[];
  exit: Partial<Record<ExitItemId, { at: number; by: string }>>;
  createdAt: number;
  createdBy: Person;
  closedAt: number | null;
  closedBy: Person | null;
  updatedAt: number;
};

/** O índice que o menu e o sino leem numa só leitura. */
export type PassagemIndexEntry = {
  id: string;
  status: PassagemStatus;
  outgoing: string;
  incoming: string[];
  startDate: string;
  endDate: string;
};

export function indexEntryOf(p: Passagem): PassagemIndexEntry {
  return {
    id: p.id,
    status: p.status,
    outgoing: p.outgoing.username,
    incoming: Array.from(new Set(p.projects.map((x) => x.incoming?.username).filter((u): u is string => Boolean(u)))),
    startDate: p.startDate,
    endDate: p.endDate,
  };
}

/* ------------------------------------------------------------------ */
/*  A ficha de cada projeto                                            */
/* ------------------------------------------------------------------ */

export type SectionId = "estado" | "objetivos" | "pessoas" | "proximos" | "historico" | "riscos" | "onde";

export type FichaSection = {
  id: SectionId;
  title: string;
  /** A pergunta a que a secção responde. */
  lead: string;
  /** O que não pode faltar — guia para quem escreve. */
  prompts: string[];
};

export const FICHA_SECTIONS: FichaSection[] = [
  {
    id: "estado",
    title: "Onde está o projeto",
    lead: "Se o novo consultor pegasse nisto amanhã, o que precisava de saber primeiro?",
    prompts: ["Fase do roadmap e semana em que está", "O que entregaste no último mês", "O que ficou a meio e porquê"],
  },
  {
    id: "objetivos",
    title: "Objetivos e resultados",
    lead: "O que o cliente quer e como está a correr.",
    prompts: [
      "Serviços, páginas e keywords prioritárias",
      "Os números que o cliente segue (tráfego, leads, posições)",
      "O que já se conseguiu e o que ainda não",
    ],
  },
  {
    id: "pessoas",
    title: "O cliente e as pessoas",
    lead: "Com quem se fala e como.",
    prompts: [
      "Quem decide, quem aprova e quem paga",
      "Canal preferido e horários (WhatsApp, email, chamada)",
      "Tom, sensibilidades e o que irrita o cliente",
    ],
  },
  {
    id: "proximos",
    title: "Próximos passos",
    lead: "O que tem data nas próximas semanas.",
    prompts: [
      "Tarefas abertas e entregáveis com data",
      "Reuniões já marcadas",
      "Tudo o que prometeste ao cliente e ainda não está feito",
    ],
  },
  {
    id: "historico",
    title: "Histórico e decisões",
    lead: "O que não está escrito em lado nenhum.",
    prompts: [
      "O que já se tentou e não resultou",
      "Problemas passados com o cliente e como se resolveram",
      "Decisões importantes e o porquê",
    ],
  },
  {
    id: "riscos",
    title: "Riscos e alertas",
    lead: "O que pode correr mal na passagem.",
    prompts: [
      "Risco de o cliente sair ou de baixar de plano",
      "Pagamentos em atraso, NPS baixo, pedidos fora do âmbito",
      "Dependências de terceiros (web designer, outra agência, programador)",
    ],
  },
  {
    id: "onde",
    title: "Onde está tudo",
    lead: "Os sítios onde o novo consultor vai trabalhar.",
    prompts: [
      "Pasta da Drive, documentos e relatórios",
      "Gravações do Fathom com o cliente",
      "Canal de Slack, grupo de WhatsApp e outras ferramentas",
    ],
  },
];

export const SECTION_MAX = 4000;
/** Abaixo disto a secção conta como por escrever. */
export const SECTION_MIN_FILLED = 40;

export type AccessId = "gsc" | "ga4" | "gbp" | "cms" | "hosting" | "rank" | "ads" | "whatsapp" | "slack" | "drive";

export const ACCESS_ITEMS: Array<{ id: AccessId; label: string }> = [
  { id: "gsc", label: "Google Search Console" },
  { id: "ga4", label: "Google Analytics 4" },
  { id: "gbp", label: "Google Business Profile" },
  { id: "cms", label: "Site / CMS (WordPress, Shopify…)" },
  { id: "hosting", label: "Alojamento e domínio (DNS)" },
  { id: "rank", label: "Projeto no Semrush / SE Ranking" },
  { id: "ads", label: "Google Ads / Meta Ads" },
  { id: "whatsapp", label: "Grupo de WhatsApp do cliente" },
  { id: "slack", label: "Canal de Slack do cliente" },
  { id: "drive", label: "Pasta da Drive e documentos" },
];

export type AccessState = "ok" | "falta" | "na";

export const ACCESS_STATES: Array<{ id: AccessState; label: string; hint: string }> = [
  { id: "ok", label: "Garantido", hint: "O novo consultor consegue entrar: está na conta da agência ou no cofre do cliente." },
  { id: "falta", label: "Em falta", hint: "Ainda só tu tens acesso, ou o cliente ainda não deu." },
  { id: "na", label: "Não se aplica", hint: "Este cliente não tem isto." },
];

export type Health = "verde" | "amarelo" | "vermelho";

export const HEALTH: Array<{ id: Health; label: string; hint: string; color: string }> = [
  { id: "verde", label: "Estável", hint: "Cliente satisfeito, sem nada a apagar.", color: "#34d399" },
  { id: "amarelo", label: "Atenção", hint: "Há uma questão a acompanhar de perto.", color: "#fbbf24" },
  { id: "vermelho", label: "Em risco", hint: "Pode sair ou está insatisfeito.", color: "#fb7185" },
];

export function healthOf(h: Health | null): (typeof HEALTH)[number] | null {
  return h ? (HEALTH.find((x) => x.id === h) ?? null) : null;
}

export const ACCESS_NOTES_MAX = 1500;
export const HEALTH_WHY_MAX = 300;

export type Ficha = {
  sections: Partial<Record<SectionId, string>>;
  accesses: Partial<Record<AccessId, AccessState>>;
  accessNotes: string;
  health: Health | null;
  healthWhy: string;
  /** Reunião a três (quem sai, quem entra e o cliente) — yyyy-mm-dd. */
  meetingDate: string | null;
  meetingDone: boolean;
  /** O cliente já sabe quem é o novo consultor. */
  clientInformed: boolean;
  /** Quem sai marcou a ficha como pronta para ler. */
  readyAt: number | null;
  updatedAt: number;
};

export function emptyFicha(): Ficha {
  return {
    sections: {},
    accesses: {},
    accessNotes: "",
    health: null,
    healthWhy: "",
    meetingDate: null,
    meetingDone: false,
    clientInformed: false,
    readyAt: null,
    updatedAt: 0,
  };
}

const SECTION_IDS = new Set<string>(FICHA_SECTIONS.map((s) => s.id));
const ACCESS_IDS = new Set<string>(ACCESS_ITEMS.map((a) => a.id));
const ACCESS_STATE_IDS = new Set<string>(ACCESS_STATES.map((a) => a.id));
const HEALTH_IDS = new Set<string>(HEALTH.map((h) => h.id));

function clip(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").slice(0, max) : "";
}

export function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/** O que o browser manda passa sempre por aqui: só campos conhecidos, com
 *  limites. `readyAt` e `updatedAt` são do servidor e não vêm daqui. */
export function sanitizeFichaContent(raw: unknown): Omit<Ficha, "readyAt" | "updatedAt"> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sections: Ficha["sections"] = {};
  const rs = o.sections && typeof o.sections === "object" ? (o.sections as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(rs)) {
    if (SECTION_IDS.has(k)) sections[k as SectionId] = clip(v, SECTION_MAX);
  }
  const accesses: Ficha["accesses"] = {};
  const ra = o.accesses && typeof o.accesses === "object" ? (o.accesses as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(ra)) {
    if (ACCESS_IDS.has(k) && typeof v === "string" && ACCESS_STATE_IDS.has(v)) accesses[k as AccessId] = v as AccessState;
  }
  return {
    sections,
    accesses,
    accessNotes: clip(o.accessNotes, ACCESS_NOTES_MAX),
    health: typeof o.health === "string" && HEALTH_IDS.has(o.health) ? (o.health as Health) : null,
    healthWhy: clip(o.healthWhy, HEALTH_WHY_MAX),
    meetingDate: isISODate(o.meetingDate) ? o.meetingDate : null,
    meetingDone: o.meetingDone === true,
    clientInformed: o.clientInformed === true,
  };
}

/** Lê uma ficha guardada (registos antigos sem um campo ficam com o default). */
export function hydrateFicha(raw: unknown): Ficha {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!o) return emptyFicha();
  return {
    ...sanitizeFichaContent(o),
    readyAt: typeof o.readyAt === "number" ? o.readyAt : null,
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : 0,
  };
}

export function sectionFilled(text: string | undefined): boolean {
  return (text ?? "").trim().length >= SECTION_MIN_FILLED;
}

/* ------------------------------------------------------------------ */
/*  Assinatura e perguntas                                             */
/* ------------------------------------------------------------------ */

export type Sign = { at: number; by: Person };

export const QUESTION_MAX = 600;
export const ANSWER_MAX = 1500;

export type Question = {
  id: string;
  slug: string;
  q: string;
  by: Person;
  at: number;
  a: string | null;
  aBy: Person | null;
  aAt: number | null;
};

/* ------------------------------------------------------------------ */
/*  Progresso                                                          */
/* ------------------------------------------------------------------ */

/** `label` diz o estado («Acessos verificados (5/10)»); `todo` diz o que
 *  fazer a seguir («Verificar os acessos (5/10)»). */
export type FichaStep = { id: string; label: string; todo: string; done: boolean };

/** Os passos de um projeto, pela ordem em que se fazem. */
export function fichaSteps(f: Ficha, sign: Sign | null): FichaStep[] {
  const filled = FICHA_SECTIONS.filter((s) => sectionFilled(f.sections[s.id])).length;
  const decided = ACCESS_ITEMS.filter((a) => f.accesses[a.id]).length;
  const missingAccess = ACCESS_ITEMS.filter((a) => f.accesses[a.id] === "falta").length;
  return [
    {
      id: "acessos",
      label:
        decided < ACCESS_ITEMS.length
          ? `Acessos verificados (${decided}/${ACCESS_ITEMS.length})`
          : missingAccess > 0
            ? `${missingAccess} acesso${missingAccess === 1 ? "" : "s"} em falta`
            : "Acessos garantidos",
      todo:
        decided < ACCESS_ITEMS.length
          ? `Verificar os acessos (${decided}/${ACCESS_ITEMS.length})`
          : `Resolver ${missingAccess} acesso${missingAccess === 1 ? "" : "s"} em falta`,
      done: decided === ACCESS_ITEMS.length && missingAccess === 0,
    },
    { id: "semaforo", label: "Semáforo do projeto", todo: "Definir o semáforo", done: f.health !== null },
    {
      id: "ficha",
      label: `Ficha escrita (${filled}/${FICHA_SECTIONS.length})`,
      todo: `Escrever a ficha (${filled}/${FICHA_SECTIONS.length})`,
      done: filled === FICHA_SECTIONS.length,
    },
    { id: "cliente", label: "Cliente avisado", todo: "Avisar o cliente", done: f.clientInformed },
    { id: "reuniao", label: "Reunião a três feita", todo: "Fazer a reunião a três", done: f.meetingDone },
    { id: "pronta", label: "Ficha marcada como pronta", todo: "Marcar a ficha como pronta", done: f.readyAt !== null },
    { id: "assumido", label: "Novo consultor assumiu", todo: "Quem entra ler e assumir", done: sign !== null },
  ];
}

export function fichaProgress(f: Ficha, sign: Sign | null): { done: number; total: number; pct: number; next: FichaStep | null } {
  const steps = fichaSteps(f, sign);
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100), next: steps.find((s) => !s.done) ?? null };
}

export type ProjectStage = "por-comecar" | "em-escrita" | "pronta" | "assumido" | "passado";

export const STAGE_LABEL: Record<ProjectStage, string> = {
  "por-comecar": "Por começar",
  "em-escrita": "Em escrita",
  pronta: "Pronta — à espera de quem entra",
  assumido: "Assumido",
  passado: "Passado no SEO DPT",
};

export function stageOf(f: Ficha, sign: Sign | null, transferred: boolean): ProjectStage {
  if (transferred) return "passado";
  if (sign) return "assumido";
  if (f.readyAt) return "pronta";
  if (f.updatedAt > 0) return "em-escrita";
  return "por-comecar";
}

/* ------------------------------------------------------------------ */
/*  Os 30 dias                                                         */
/* ------------------------------------------------------------------ */

export type Phase = { n: number; from: number; to: number; title: string; detail: string };

export const PHASES: Phase[] = [
  { n: 1, from: 1, to: 7, title: "Inventário", detail: "Os acessos de cada projeto garantidos e o semáforo de cada cliente." },
  { n: 2, from: 8, to: 17, title: "Fichas", detail: "A ficha de cada projeto escrita: tudo o que quem entra tem de saber." },
  {
    n: 3,
    from: 18,
    to: 25,
    title: "Apresentação",
    detail: "Cada cliente avisado, a reunião a três feita e as perguntas de quem entra respondidas.",
  },
  { n: 4, from: 26, to: 30, title: "Fecho", detail: "Quem entra assume cada projeto e a direção passa-o no SEO DPT." },
];

function isoToUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysISO(iso: string, days: number): string {
  return new Date(isoToUTC(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetweenISO(fromISO: string, toISO: string): number {
  return Math.round((isoToUTC(toISO) - isoToUTC(fromISO)) / 86_400_000);
}

/** Dia do processo (1 = o primeiro); 0 antes de começar. */
export function dayOf(p: Pick<Passagem, "startDate">, todayISO: string): number {
  const d = daysBetweenISO(p.startDate, todayISO) + 1;
  return d < 1 ? 0 : d;
}

export function totalDaysOf(p: Pick<Passagem, "startDate" | "endDate">): number {
  return Math.max(1, daysBetweenISO(p.startDate, p.endDate) + 1);
}

/** A fase de um dia, esticada à duração real (se a direção mudou o fim). */
export function phaseFor(day: number, totalDays: number): Phase {
  const scaled = Math.ceil((Math.max(1, day) / totalDays) * PASSAGEM_DAYS);
  return PHASES.find((ph) => scaled >= ph.from && scaled <= ph.to) ?? PHASES[PHASES.length - 1];
}

/* ------------------------------------------------------------------ */
/*  Mensagem ao cliente                                                */
/* ------------------------------------------------------------------ */

/** Rascunho para quem sai avisar o cliente (na língua do cliente). */
export function clientMessageDraft(lang: "pt" | "en", incomingName: string | null, dateLabel: string): string {
  const who = incomingName ?? (lang === "en" ? "[name]" : "[nome]");
  return lang === "en"
    ? `Hi! A quick update: from ${dateLabel}, your SEO project will be looked after by ${who}, who is already up to speed on all the work. I'm still with you until then, and we'll set up a short three-way call to introduce you. Any questions, just let me know.`
    : `Olá! Queria partilhar uma novidade: a partir de ${dateLabel}, o acompanhamento do vosso projeto de SEO passa a ser feito por ${who}, que já está a par de todo o trabalho. Até lá continuo convosco e vamos marcar uma chamada rápida a três para vos apresentar. Qualquer dúvida, estou por aqui.`;
}

/** O primeiro nome, sem o ponto de abreviaturas («Fran. Rosa» → «Fran»). */
export function firstName(name: string): string {
  return (name.trim().split(/\s+/)[0] ?? name).replace(/\.$/, "");
}

/** «24/11/2026». */
export function formatISODate(iso: string | null | undefined): string {
  if (!iso || !isISODate(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
