// Recrutamento (v80.16) — a Fase 2 · Parte 2: a prova prática.
//
// Ao contrário da entrevista (o André pontua ao vivo), a prática faz-se pelo
// CANDIDATO num link público (/candidatura/<token>) e é avaliada depois na
// ficha. O texto é o do guião do André («Entrevista Fase 2 — Prática Parte 2»,
// PDF de 20/11/2026), transcrito tal e qual. NUNCA inventar enunciados nem
// critérios (memória «never author training content»): o guião não tem
// grelha, por isso a avaliação é uma nota 0–10 por ponto + notas.
//
// Módulo puro: corre no browser (página do candidato e avaliação) e no
// servidor (a limpeza do que chega pela API pública).

export const PRACTICAL_TEMPLATE_ID = "seo-geo-fase2-p2-pratica";

export type PracticalTextBlock =
  | { kind: "p"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "note"; text: string }
  | { kind: "code"; title: string; lead: string; code: string };

/** Um ponto avaliável do guião (1, 2.1, 2.2, 3.1, 3.2, 4). */
export type PracticalItemId = "audit" | "priorities" | "fix" | "keywords" | "roadmap" | "code";

export type PracticalItem = {
  id: PracticalItemId;
  code: string;
  /** Título curto para a avaliação e a navegação. */
  short: string;
  /** Subtítulo do guião («2.1»), quando o ponto é um sub-ponto. */
  label?: string;
  body: PracticalTextBlock[];
};

export type PracticalSection = {
  n: number;
  title: string;
  /** Linhas antes dos sub-pontos (o «Site:» da auditoria vai à parte). */
  lead?: PracticalTextBlock[];
  items: PracticalItem[];
};

export type PracticalTemplate = {
  id: string;
  version: number;
  title: string;
  subtitle: string;
  phase: string;
  role: string;
  durationMin: number;
  intro: string[];
  sections: PracticalSection[];
};

const CODE_SNIPPET = `<!DOCTYPE html>
<html>
<head>
    <title>Clínica Dentária Lisboa - Bem-vindo ao nosso site | Melhores dentistas de Portugal | Implantes, Ortodontia e Estética Dentária Premium em Lisboa</title>
    <meta charset="UTF-8">
    <link rel="canonical" href="https://www.clinica.pt/">
    <meta property="og:title" content="Clínica Dentária">
    <meta name="robots" content="noindex, nofollow">
</head>
<body>
    <h2>Bem-vindo à Clínica</h2>
    <h1>Sobre os nossos serviços</h1>
    <h1>Implantes Dentários</h1>
    <p>Os melhores implantes de Lisboa.</p>
    <img src="/imgs/implante.jpg">
    <img src="/imgs/equipa.png" alt="">
    <img src="/imgs/logo.png" alt="Clínica Dentária Lisboa Implantes Ortodontia Estética Dentária Premium">
    <a href="/servicos">Clica aqui</a>
    <a href="/contactos">Saber mais</a>
    <a href="/blog/artigo-1">Ler mais</a>
</body>
</html>`;

export const SEO_GEO_PRATICA: PracticalTemplate = {
  id: PRACTICAL_TEMPLATE_ID,
  version: 1,
  title: "Entrevista Fase 2 — Prática Parte 2",
  subtitle: "SEO/GEO Consultant · WonderAds SEO/GEO DPT · Duração total: 240 min.",
  phase: "Fase 2 · Parte 2",
  role: "Consultor de SEO",
  durationMin: 240,
  intro: [
    "Ao longo do exercício, podes usar o teu pc e qualquer ferramenta (Ahrefs, SEMrush, Screaming Frog, GSC público, etc.).",
    "O que interessa é como pensas e como priorizas as coisas, não cobrir tudo com demasiado textos de ChatGPT, etc..",
  ],
  sections: [
    {
      n: 1,
      title: "Conduz uma Auditoria (visual, on-page, off-page e técnica)",
      items: [
        {
          id: "audit",
          code: "1",
          short: "Auditoria e vídeos",
          body: [
            { kind: "p", text: "Faz uma auditoria ao site." },
            {
              kind: "p",
              text: "No fim, apresenta em 5-15 minutos, as descobertas mais importantes (podes utilizar o loom.com versão gratuita e enviar 1-3 vídeos - cada com 5 minutos no máximo na versão gratuita - de overview do que encontraste na auditoria - o importante destes vídeos é percebermos a tua maneira de pensar e o que sabes de cabeça).",
            },
          ],
        },
      ],
    },
    {
      n: 2,
      title: "Prioridades pós-auditoria",
      items: [
        {
          id: "priorities",
          code: "2.1",
          label: "2.1",
          short: "Prioridades (PDF)",
          body: [
            { kind: "p", text: "Ordena os problemas por prioridade (o que resolves 1.º, 2.º, 3.º…) num doc word (enviar em pdf)." },
            { kind: "p", text: "Justifica a ordem com impacto vs esforço (low hanging fruits/quick wins), não só gravidade técnica." },
          ],
        },
        {
          id: "fix",
          code: "2.2",
          label: "2.2",
          short: "Resolver uma prioridade",
          body: [
            {
              kind: "p",
              text: "Escolhe uma prioridade da lista do ponto 2.1 e explica como se resolvem na prática - assume que o cliente é wordpress com elementor e os plugins que precisares.",
            },
          ],
        },
      ],
    },
    {
      n: 3,
      title: "Keyword research e roadmap",
      items: [
        {
          id: "keywords",
          code: "3.1",
          label: "3.1",
          short: "Keyword research",
          body: [
            {
              kind: "p",
              text: "Executa uma keyword research para o cliente (máx. de 35 keywords - algumas principais e outras de campos semânticos). Assinala premium keywords (keywords quase no top 3 que com algum esforço conseguimos subir para top 3) e explica o critério que usaste para as escolher.",
            },
          ],
        },
        {
          id: "roadmap",
          code: "3.2",
          label: "3.2",
          short: "Roadmap de 3 meses",
          body: [
            {
              kind: "p",
              text: "Constrói um SEO roadmap de 3 meses (Mês 1, Mês 2, Mês 3) com focos e entregáveis por mês. Não precisa de ser detalhado por semana.",
            },
            {
              kind: "note",
              text: "(nota: os consultores SEO da WA fazem os seus roadmaps detalhados à semana quando terminam a sua formação interna)",
            },
          ],
        },
      ],
    },
    {
      n: 4,
      title: "Análise Rápida de código",
      lead: [
        { kind: "p", text: "Vês este snippet no teu projeto real de SEO." },
        { kind: "p", text: "Identifica os problemas." },
        {
          kind: "bullets",
          items: ["Ordena-os por impacto SEO (crítico, médio, baixo).", "Explica como corrigirias os críticos."],
        },
      ],
      items: [
        {
          id: "code",
          code: "4.1",
          label: "4.1",
          short: "Análise de código",
          body: [
            {
              kind: "code",
              title: "HTML e <head>",
              lead: "Página \"Implantes Dentários\" de uma clínica em Lisboa.",
              code: CODE_SNIPPET,
            },
          ],
        },
      ],
    },
  ],
};

export const PRACTICAL_TEMPLATES: PracticalTemplate[] = [SEO_GEO_PRATICA];

export function getPracticalTemplate(id: string): PracticalTemplate | null {
  return PRACTICAL_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function practicalItems(t: PracticalTemplate): PracticalItem[] {
  return t.sections.flatMap((s) => s.items);
}

// ---------------------------------------------------------------------------
// O que o candidato entrega
// ---------------------------------------------------------------------------

export const MAX_LOOMS = 3;
export const MAX_KEYWORDS = 35;
export const MAX_CODE_ISSUES = 30;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export type Impact = "critico" | "medio" | "baixo" | "";
export const IMPACTS: Array<{ id: Exclude<Impact, "">; label: string }> = [
  { id: "critico", label: "Crítico" },
  { id: "medio", label: "Médio" },
  { id: "baixo", label: "Baixo" },
];

export type KeywordRow = { kw: string; volume: string; position: string; premium: boolean };
export type CodeIssue = { text: string; impact: Impact };
export type UploadedFile = { url: string; name: string; size: number; uploadedAt: number };

export type PracticalAnswers = {
  looms: string[];
  auditNotes: string;
  prioritiesFile: UploadedFile | null;
  prioritiesNote: string;
  fix: string;
  keywords: KeywordRow[];
  premiumCriteria: string;
  roadmap: Array<{ focus: string; deliverables: string }>;
  codeIssues: CodeIssue[];
  codeFix: string;
};

export function emptyAnswers(): PracticalAnswers {
  return {
    looms: [""],
    auditNotes: "",
    prioritiesFile: null,
    prioritiesNote: "",
    fix: "",
    keywords: [],
    premiumCriteria: "",
    roadmap: [
      { focus: "", deliverables: "" },
      { focus: "", deliverables: "" },
      { focus: "", deliverables: "" },
    ],
    codeIssues: [],
    codeFix: "",
  };
}

/** O estado da prova do lado do candidato (KV hr:practical-sub:<id>). */
export type PracticalSubmission = {
  openedAt: number | null;
  startedAt: number | null;
  submittedAt: number | null;
  updatedAt: number;
  answers: PracticalAnswers;
};

export function emptySubmission(): PracticalSubmission {
  return { openedAt: null, startedAt: null, submittedAt: null, updatedAt: 0, answers: emptyAnswers() };
}

function obj(raw: unknown): Record<string, unknown> | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

/** Só ficheiros do nosso Blob (o upload passa pela nossa rota). */
export function isOurBlobUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i.test(url);
}

export function hydrateAnswers(raw: unknown): PracticalAnswers {
  const o = obj(raw);
  const base = emptyAnswers();
  if (!o) return base;
  const looms = arr(o.looms).map((x) => s(x, 400)).slice(0, MAX_LOOMS);
  const f = obj(o.prioritiesFile);
  const fileUrl = f ? s(f.url, 600) : "";
  const roadmap = arr(o.roadmap)
    .slice(0, 3)
    .map((m) => {
      const x = obj(m) ?? {};
      return { focus: s(x.focus, 3000), deliverables: s(x.deliverables, 3000) };
    });
  while (roadmap.length < 3) roadmap.push({ focus: "", deliverables: "" });
  return {
    looms: looms.length ? looms : [""],
    auditNotes: s(o.auditNotes, 6000),
    prioritiesFile:
      f && fileUrl && isOurBlobUrl(fileUrl)
        ? { url: fileUrl, name: s(f.name, 200) || "prioridades.pdf", size: Math.max(0, n(f.size) ?? 0), uploadedAt: n(f.uploadedAt) ?? 0 }
        : null,
    prioritiesNote: s(o.prioritiesNote, 2000),
    fix: s(o.fix, 12000),
    keywords: arr(o.keywords)
      .slice(0, MAX_KEYWORDS)
      .map((k) => {
        const x = obj(k) ?? {};
        return { kw: s(x.kw, 160), volume: s(x.volume, 20), position: s(x.position, 20), premium: x.premium === true };
      }),
    premiumCriteria: s(o.premiumCriteria, 4000),
    roadmap,
    codeIssues: arr(o.codeIssues)
      .slice(0, MAX_CODE_ISSUES)
      .map((c) => {
        const x = obj(c) ?? {};
        const impact = x.impact === "critico" || x.impact === "medio" || x.impact === "baixo" ? x.impact : "";
        return { text: s(x.text, 500), impact };
      }),
    codeFix: s(o.codeFix, 8000),
  };
}

export function hydrateSubmission(raw: unknown): PracticalSubmission {
  const o = obj(raw);
  if (!o) return emptySubmission();
  return {
    openedAt: n(o.openedAt),
    startedAt: n(o.startedAt),
    submittedAt: n(o.submittedAt),
    updatedAt: n(o.updatedAt) ?? 0,
    answers: hydrateAnswers(o.answers),
  };
}

/** O que falta, para o aviso antes de entregar (não impede a entrega). */
export function missingParts(a: PracticalAnswers): string[] {
  const out: string[] = [];
  if (!a.looms.some((l) => l.trim())) out.push("1 · os vídeos da auditoria");
  if (!a.prioritiesFile) out.push("2.1 · o PDF das prioridades");
  if (!a.fix.trim()) out.push("2.2 · como resolves a prioridade escolhida");
  if (!a.keywords.some((k) => k.kw.trim())) out.push("3.1 · as keywords");
  else if (!a.keywords.some((k) => k.kw.trim() && k.premium)) out.push("3.1 · as premium keywords assinaladas");
  if (!a.premiumCriteria.trim()) out.push("3.1 · o critério das premium");
  if (!a.roadmap.some((m) => m.focus.trim() || m.deliverables.trim())) out.push("3.2 · o roadmap");
  if (!a.codeIssues.some((c) => c.text.trim())) out.push("4 · os problemas do código");
  if (!a.codeFix.trim()) out.push("4 · como corrigirias os críticos");
  return out;
}

// ---------------------------------------------------------------------------
// A avaliação (na ficha do candidato)
// ---------------------------------------------------------------------------

export type PracticalReview = {
  scores: Partial<Record<PracticalItemId, number | null>>;
  notes: Partial<Record<PracticalItemId, string>>;
  /** «A minha nota» — ganha à média dos pontos. */
  overall: number | null;
  summary: string;
};

export function emptyReview(): PracticalReview {
  return { scores: {}, notes: {}, overall: null, summary: "" };
}

const ITEM_IDS: PracticalItemId[] = ["audit", "priorities", "fix", "keywords", "roadmap", "code"];

export function hydrateReview(raw: unknown): PracticalReview {
  const o = obj(raw);
  const base = emptyReview();
  if (!o) return base;
  const sc = obj(o.scores) ?? {};
  const nt = obj(o.notes) ?? {};
  const score = (v: unknown) => {
    const x = n(v);
    return x === null ? null : Math.min(10, Math.max(0, Math.round(x)));
  };
  for (const id of ITEM_IDS) {
    if (sc[id] !== undefined) base.scores[id] = score(sc[id]);
    if (typeof nt[id] === "string") base.notes[id] = s(nt[id], 6000);
  }
  base.overall = score(o.overall);
  base.summary = s(o.summary, 8000);
  return base;
}

/** Nota da prática: a do avaliador, senão a média dos pontos avaliados. */
export function practicalScore(r: PracticalReview): { avg: number | null; final: number | null; scored: number } {
  const list = ITEM_IDS.map((id) => r.scores[id]).filter((x): x is number => typeof x === "number");
  const avg = list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : null;
  return { avg, final: r.overall ?? avg, scored: list.length };
}

/** Uma fase prática na ficha do candidato (as respostas vivem à parte). */
export type Practical = {
  id: string;
  templateId: string;
  templateVersion: number;
  /** O segredo do link público /candidatura/<token>. */
  token: string;
  /** O site a auditar («a definir na app workspace»). */
  site: string;
  date: string | null;
  createdAt: number;
  createdBy: string;
  review: PracticalReview;
  reviewer: string | null;
  reviewedAt: number | null;
};

export function hydratePractical(raw: unknown): Practical | null {
  const o = obj(raw);
  if (!o || typeof o.id !== "string" || typeof o.token !== "string") return null;
  return {
    id: o.id,
    templateId: s(o.templateId, 100) || PRACTICAL_TEMPLATE_ID,
    templateVersion: n(o.templateVersion) ?? 1,
    token: s(o.token, 80),
    site: s(o.site, 400),
    date: s(o.date, 10) || null,
    createdAt: n(o.createdAt) ?? 0,
    createdBy: s(o.createdBy, 100),
    review: hydrateReview(o.review),
    reviewer: s(o.reviewer, 100) || null,
    reviewedAt: n(o.reviewedAt),
  };
}

export type PracticalStage = "por-abrir" | "aberto" | "em-curso" | "entregue" | "avaliada";

export function practicalStage(p: Practical, sub: PracticalSubmission | null): PracticalStage {
  if (p.reviewedAt) return "avaliada";
  if (sub?.submittedAt) return "entregue";
  if (sub?.startedAt) return "em-curso";
  if (sub?.openedAt) return "aberto";
  return "por-abrir";
}

export const PRACTICAL_STAGE_LABEL: Record<PracticalStage, string> = {
  "por-abrir": "Link por abrir",
  aberto: "Link aberto",
  "em-curso": "Em curso",
  entregue: "Entregue",
  avaliada: "Avaliada",
};

/** «https://www.loom.com/share/abc» → o endereço para embeber, se for Loom. */
export function loomEmbed(url: string): string | null {
  const m = url.trim().match(/^https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  return m ? `https://www.loom.com/embed/${m[1]}` : null;
}

export function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export function fmtBytes(b: number): string {
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}
