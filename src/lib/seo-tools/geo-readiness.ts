// AEO / GEO READINESS — o site está preparado para ser CITADO por um motor
// de resposta?
//
// A outra metade do GEO. `geo-intel.ts` mede o mercado (que perguntas se
// fazem, quem é citado); isto mede o que depende só de nós. E ao contrário
// do corpus de perguntas — que em português ainda tem buracos — esta
// auditoria tem SEMPRE resposta, porque é o próprio site a responder.
//
// Quatro perguntas, por esta ordem, porque cada uma só faz sentido se a
// anterior estiver resolvida:
//
//   1. ACESSO — os agentes conseguem sequer ler o site? Um `robots.txt` que
//      bloqueia o OAI-SearchBot tira o site do ChatGPT com pesquisa, e
//      quase toda a gente que o fez fê-lo sem saber, a copiar uma lista de
//      "bloquear bots de IA" da internet. Treino e pesquisa são coisas
//      diferentes: bloquear o GPTBot é uma decisão editorial defensável;
//      bloquear o OAI-SearchBot é desaparecer.
//   2. COMPREENSÃO — o motor percebe QUEM somos e o que vendemos? É aqui
//      que os dados estruturados deixam de ser um capricho de SEO: uma
//      resposta generativa cita entidades, e uma entidade sem
//      Organization/sameAs é um sítio anónimo com texto.
//   3. EXTRAÇÃO — o conteúdo tem a forma que uma resposta cita? Perguntas
//      como títulos, a resposta nas primeiras linhas, listas e tabelas. Um
//      texto excelente escrito em oito parágrafos corridos é praticamente
//      inutilizável para quem tem de citar duas frases.
//   4. CONFIANÇA — há autor, data, morada, telefone, coerência de língua?
//      É o que separa ser citado de ser lido e descartado.
//
// Tudo isto sai de um crawl que já sabemos fazer (`crawler.ts`) mais dois
// GET a ficheiros de texto. Custo: zero.

import { crawlMany, crawlPage, type CrawlResult } from "./crawler";
import { bareDomain } from "./dataforseo-ranks";

const FETCH_TIMEOUT_MS = 15_000;

/** Páginas internas auditadas além da homepage. Três chegam para saber se o
 *  padrão de marcação é do site ou só da entrada. */
const MAX_KEY_PAGES = 3;

export type GeoCheckStatus = "pass" | "warn" | "fail" | "unknown";

export type GeoPillar = "access" | "understanding" | "extraction" | "trust";

export type GeoCheck = {
  id: string;
  pillar: GeoPillar;
  label: string;
  status: GeoCheckStatus;
  /** O que foi encontrado, em concreto. */
  detail: string;
  /** Porque é que isto conta para ser citado por uma IA. */
  why: string;
  /** O que fazer quando não está bem. Vazio quando está. */
  fix: string;
  /** Peso no score. 3 = decide, 2 = pesa, 1 = afina. */
  weight: 1 | 2 | 3;
};

export type GeoReadiness = {
  checkedOn: string;
  domain: string;
  /** O site não respondeu ao rastreio. É um resultado, não uma falha da
   *  auditoria: o que um agente não consegue buscar, não pode citar. */
  unreachable: boolean;
  /** URLs auditados (homepage + páginas-chave). */
  pagesAudited: string[];
  checks: GeoCheck[];
  /** 0–100 global e por pilar. */
  score: number;
  pillarScores: Record<GeoPillar, number>;
  /** Bots de IA e o que o robots.txt lhes diz. */
  bots: { name: string; label: string; allowed: boolean | null; critical: boolean }[];
  hasLlmsTxt: boolean;
  /** Tipos de schema.org encontrados em todo o conjunto auditado. */
  schemaTypes: string[];
};

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

/** Os agentes que importam, e o que cada um faz. `critical` = bloqueá-lo
 *  remove o site de um motor de resposta com utilizadores reais, e não
 *  apenas de um conjunto de treino. */
const AI_BOTS: { name: string; label: string; critical: boolean }[] = [
  { name: "OAI-SearchBot", label: "ChatGPT Search (OpenAI)", critical: true },
  { name: "ChatGPT-User", label: "ChatGPT a navegar em direto", critical: true },
  { name: "PerplexityBot", label: "Perplexity", critical: true },
  { name: "Perplexity-User", label: "Perplexity a navegar em direto", critical: true },
  { name: "Google-Extended", label: "Gemini / AI Overviews", critical: true },
  { name: "ClaudeBot", label: "Claude (Anthropic)", critical: true },
  { name: "Applebot-Extended", label: "Apple Intelligence", critical: false },
  { name: "GPTBot", label: "OpenAI (treino de modelos)", critical: false },
  { name: "CCBot", label: "Common Crawl", critical: false },
  { name: "Bytespider", label: "ByteDance / Doubao", critical: false },
  { name: "meta-externalagent", label: "Meta AI", critical: false },
];

type RobotsGroup = { agents: string[]; disallow: string[]; allow: string[] };

function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "disallow") current.disallow.push(value);
    else if (field === "allow") current.allow.push(value);
  }
  return groups;
}

/** O grupo que se aplica a um agente: o mais específico primeiro, `*` como
 *  rede. null = não há robots.txt legível, que é diferente de "permitido". */
function botAllowed(groups: RobotsGroup[], bot: string): boolean {
  const lower = bot.toLowerCase();
  const own = groups.find((g) => g.agents.includes(lower));
  const star = groups.find((g) => g.agents.includes("*"));
  const g = own ?? star;
  if (!g) return true;
  // Só interessa a raiz: um Disallow: / fecha o site, um Disallow: /admin/
  // não afeta a possibilidade de ser citado.
  const blocksRoot = g.disallow.some((d) => d === "/" || d === "/*");
  if (!blocksRoot) return true;
  return g.allow.some((a) => a === "/" || a === "/*");
}

async function fetchText(url: string): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; WonderAdsSEOBot/1.0; +https://wonder-ads.com)",
      },
    });
    if (!res.ok) return { ok: false, text: "" };
    const text = await res.text();
    // Um SPA devolve o index.html com 200 para /llms.txt — se vier HTML,
    // o ficheiro não existe.
    if (/^\s*<(!doctype|html)/i.test(text)) return { ok: false, text: "" };
    return { ok: true, text };
  } catch {
    return { ok: false, text: "" };
  }
}

// ---------------------------------------------------------------------------
// Leitura do JSON-LD
// ---------------------------------------------------------------------------

type JsonLdNode = Record<string, unknown>;

function flattenJsonLd(raw: unknown[]): JsonLdNode[] {
  const out: JsonLdNode[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || v === null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    const node = v as JsonLdNode;
    out.push(node);
    for (const key of ["@graph", "mainEntity", "itemListElement", "hasPart"]) {
      if (key in node) walk(node[key], depth + 1);
    }
  };
  walk(raw, 0);
  return out;
}

function typesOf(node: JsonLdNode): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function hasType(nodes: JsonLdNode[], ...needles: string[]): boolean {
  const set = new Set(needles.map((n) => n.toLowerCase()));
  return nodes.some((n) => typesOf(n).some((t) => set.has(t.toLowerCase())));
}

function findWithType(nodes: JsonLdNode[], ...needles: string[]): JsonLdNode | null {
  const set = new Set(needles.map((n) => n.toLowerCase()));
  return nodes.find((n) => typesOf(n).some((t) => set.has(t.toLowerCase()))) ?? null;
}

/** Business types que valem como identidade de entidade — a lista da
 *  schema.org é enorme, mas para a carteira (clínicas, ginásios, escolas)
 *  qualquer descendente de LocalBusiness serve. */
const ORG_TYPES = [
  "Organization", "LocalBusiness", "MedicalBusiness", "MedicalClinic",
  "Dentist", "Physician", "HealthAndBeautyBusiness", "HealthClub",
  "ExerciseGym", "SportsActivityLocation", "BeautySalon", "HairSalon",
  "EducationalOrganization", "Restaurant", "LodgingBusiness", "Hotel",
  "ProfessionalService", "Store",
];

// ---------------------------------------------------------------------------
// Perguntas nos títulos
// ---------------------------------------------------------------------------

const QUESTION_STARTERS =
  /^(o que|que |qual|quais|quando|onde|como|porqu|por que|quanto|quem|vale a pena|é (?:seguro|normal|possível|bom)|posso|devo|what|which|when|where|how|why|who|is |are |can |should |does |do )/i;

function isQuestion(h: string): boolean {
  const s = h.trim();
  return s.endsWith("?") || QUESTION_STARTERS.test(s);
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

const PILLAR_LABEL: Record<GeoPillar, string> = {
  access: "Acesso",
  understanding: "Compreensão",
  extraction: "Extração",
  trust: "Confiança",
};

export function pillarLabel(p: GeoPillar): string {
  return PILLAR_LABEL[p];
}

export async function auditGeoReadiness(
  website: string,
  opts: { keyPages?: string[]; expectedLang?: string } = {},
): Promise<GeoReadiness | null> {
  const domain = bareDomain(website);
  if (!domain) return null;
  const origin = website.startsWith("http") ? new URL(website).origin : `https://${domain}`;

  const keyPages = Array.from(
    new Set((opts.keyPages ?? []).filter((u) => u && u.startsWith("http"))),
  )
    .filter((u) => {
      try {
        return new URL(u).pathname !== "/";
      } catch {
        return false;
      }
    })
    .slice(0, MAX_KEY_PAGES);

  const [home, robotsRes, llmsRes, llmsFullRes, others] = await Promise.all([
    crawlPage(origin, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(
      () => null,
    ),
    fetchText(`${origin}/robots.txt`),
    fetchText(`${origin}/llms.txt`),
    fetchText(`${origin}/llms-full.txt`),
    keyPages.length > 0
      ? crawlMany(keyPages, { concurrency: 3 })
      : Promise.resolve([]),
  ]);

  const pages: CrawlResult[] = [
    ...(home ? [home] : []),
    ...others.flatMap((o) => (o.ok ? [o.result] : [])),
  ];

  // O SITE NÃO RESPONDEU. Não se devolve null: um domínio que não se deixa
  // buscar em 15 s é, para um motor de resposta, um domínio que não existe —
  // e isso é a conclusão mais importante que esta auditoria pode dar. Sai
  // um relatório curto e verdadeiro em vez de secção nenhuma.
  if (pages.length === 0) {
    const reachable: GeoCheck = {
      id: "reachable",
      pillar: "access",
      label: "O site responde a um rastreador",
      status: "fail",
      detail: `${origin} não respondeu dentro de ${FETCH_TIMEOUT_MS / 1000} s.`,
      why: "Os agentes de resposta buscam a página no momento em que alguém pergunta, e desistem depressa. Um site lento ou fechado a rastreadores nunca chega a ser citado, por muito bom que seja o conteúdo.",
      fix: "Confirmar que o site está no ar e que a firewall/CDN não bloqueia agentes que não sejam browsers. Testar com `curl -A \"OAI-SearchBot\" <url>`.",
      weight: 3,
    };
    return {
      checkedOn: new Date().toISOString().slice(0, 10),
      domain,
      unreachable: true,
      pagesAudited: [],
      checks: [reachable],
      score: 0,
      pillarScores: { access: 0, understanding: 0, extraction: 0, trust: 0 },
      bots: AI_BOTS.map((b) => ({
        ...b,
        allowed: robotsRes.ok ? botAllowed(parseRobots(robotsRes.text), b.name) : null,
      })),
      hasLlmsTxt: llmsRes.ok || llmsFullRes.ok,
      schemaTypes: [],
    };
  }
  // A partir daqui há pelo menos uma página; a homepage é a primeira quando
  // existe, e é dela que saem os sinais de entidade.
  const homePage = home ?? pages[0];
  const nodes = flattenJsonLd(pages.flatMap((p) => p.jsonLdRaw));
  const schemaTypes = Array.from(
    new Set(pages.flatMap((p) => p.jsonLdTypes.map((t) => t.type))),
  ).sort();

  const checks: GeoCheck[] = [];
  const add = (c: GeoCheck) => checks.push(c);

  // ——— 1. ACESSO ————————————————————————————————————————————
  const groups = robotsRes.ok ? parseRobots(robotsRes.text) : [];
  const bots = AI_BOTS.map((b) => ({
    ...b,
    allowed: robotsRes.ok ? botAllowed(groups, b.name) : null,
  }));
  const blockedCritical = bots.filter((b) => b.critical && b.allowed === false);
  const blockedOther = bots.filter((b) => !b.critical && b.allowed === false);

  add({
    id: "robots",
    pillar: "access",
    label: "robots.txt acessível",
    status: robotsRes.ok ? "pass" : "warn",
    detail: robotsRes.ok
      ? `Encontrado, ${groups.length} grupo${groups.length === 1 ? "" : "s"} de regras.`
      : "Não foi possível ler /robots.txt.",
    why: "É o primeiro ficheiro que qualquer agente lê. Sem ele, cada motor decide por si o que pode rastrear.",
    fix: robotsRes.ok ? "" : "Publicar um /robots.txt, nem que seja só com o sitemap e um User-agent: * sem restrições.",
    weight: 1,
  });

  add({
    id: "ai-bots-critical",
    pillar: "access",
    label: "Motores de resposta autorizados a ler o site",
    status: !robotsRes.ok
      ? "unknown"
      : blockedCritical.length > 0
        ? "fail"
        : "pass",
    detail:
      blockedCritical.length > 0
        ? `Bloqueados: ${blockedCritical.map((b) => b.label).join(", ")}.`
        : "ChatGPT Search, Perplexity, Gemini e Claude podem rastrear o site.",
    why: "Estes agentes não treinam modelos — vão buscar a página NO MOMENTO em que alguém pergunta. Bloqueá-los é sair da resposta, não proteger conteúdo.",
    fix:
      blockedCritical.length > 0
        ? `Retirar do robots.txt as regras que fecham ${blockedCritical.map((b) => b.name).join(", ")}. Se a intenção era não alimentar treino de modelos, bloquear só GPTBot/CCBot mantém a presença nas respostas.`
        : "",
    weight: 3,
  });

  add({
    id: "ai-bots-training",
    pillar: "access",
    label: "Rastreadores de treino e de índice",
    status: blockedOther.length === 0 ? "pass" : "warn",
    detail:
      blockedOther.length > 0
        ? `Bloqueados: ${blockedOther.map((b) => b.label).join(", ")}.`
        : "Sem bloqueios adicionais.",
    why: "Não afetam a resposta em direto, mas alimentam o conhecimento de base dos modelos sobre a marca.",
    fix: blockedOther.length > 0 ? "Decisão editorial — só rever se a marca quiser aparecer também no conhecimento treinado." : "",
    weight: 1,
  });

  const hasLlms = llmsRes.ok || llmsFullRes.ok;
  add({
    id: "llms-txt",
    pillar: "access",
    label: "llms.txt",
    status: hasLlms ? "pass" : "warn",
    detail: hasLlms
      ? `Publicado${llmsFullRes.ok ? " (com llms-full.txt)" : ""}.`
      : "Não existe.",
    why: "Índice em markdown que diz a um modelo o que o site é e quais as páginas canónicas de cada tema. Ainda é convenção, não norma — mas é barato e já é lido.",
    fix: hasLlms ? "" : "Publicar /llms.txt com o nome da marca, uma linha de descrição e a lista das páginas de serviço com uma frase cada.",
    weight: 1,
  });

  const sitemapInRobots = /sitemap\s*:/i.test(robotsRes.text);
  add({
    id: "sitemap",
    pillar: "access",
    label: "Sitemap declarado",
    status: sitemapInRobots ? "pass" : "warn",
    detail: sitemapInRobots ? "Declarado no robots.txt." : "Sem linha Sitemap: no robots.txt.",
    why: "É como um agente descobre as páginas que não estão ligadas a partir da entrada.",
    fix: sitemapInRobots ? "" : "Acrescentar `Sitemap: https://…/sitemap.xml` ao robots.txt.",
    weight: 1,
  });

  // ——— 2. COMPREENSÃO ————————————————————————————————————————
  const org = findWithType(nodes, ...ORG_TYPES);
  const sameAs = org && Array.isArray(org.sameAs) ? (org.sameAs as unknown[]).length : 0;

  add({
    id: "jsonld",
    pillar: "understanding",
    label: "Dados estruturados (JSON-LD)",
    status: nodes.length > 0 ? "pass" : "fail",
    detail:
      nodes.length > 0
        ? `${schemaTypes.length} tipo${schemaTypes.length === 1 ? "" : "s"}: ${schemaTypes.slice(0, 8).join(", ")}${schemaTypes.length > 8 ? "…" : ""}`
        : "Nenhum bloco JSON-LD encontrado.",
    why: "É a forma de dizer a um motor o que a página é sem ele ter de adivinhar pelo texto.",
    fix: nodes.length > 0 ? "" : "Adicionar JSON-LD começando por Organization/LocalBusiness na homepage.",
    weight: 3,
  });

  add({
    id: "entity",
    pillar: "understanding",
    label: "Identidade da entidade",
    status: org ? (sameAs > 0 ? "pass" : "warn") : "fail",
    detail: org
      ? `${typesOf(org).join("/")}${sameAs > 0 ? ` com ${sameAs} perfis em sameAs` : " — sem sameAs"}`
      : "Sem Organization / LocalBusiness.",
    why: "Uma resposta generativa cita entidades, não páginas. O sameAs (Google Business, LinkedIn, Instagram, Wikipedia) é o que liga o site à mesma entidade noutras fontes.",
    fix: !org
      ? "Marcar a homepage com Organization (ou o subtipo de LocalBusiness certo) com name, url, logo, telephone e address."
      : sameAs === 0
        ? "Acrescentar sameAs com os perfis oficiais — Google Business Profile, LinkedIn, Instagram, Facebook."
        : "",
    weight: 3,
  });

  const hasFaq = hasType(nodes, "FAQPage", "QAPage");
  add({
    id: "faq",
    pillar: "understanding",
    label: "FAQPage / QAPage",
    status: hasFaq ? "pass" : "warn",
    detail: hasFaq ? "Presente." : "Nenhuma página marcada como FAQ.",
    why: "Um par pergunta→resposta marcado é a unidade que um motor de resposta copia com menos esforço — e o formato mais citado que existe.",
    fix: hasFaq ? "" : "Criar (ou marcar) uma secção de perguntas frequentes com FAQPage, usando as perguntas reais da tabela de prompts deste relatório.",
    weight: 2,
  });

  const article = findWithType(nodes, "Article", "BlogPosting", "NewsArticle", "MedicalWebPage");
  add({
    id: "article",
    pillar: "understanding",
    label: "Conteúdo editorial marcado",
    status: article ? "pass" : "warn",
    detail: article ? `${typesOf(article).join("/")} encontrado.` : "Sem Article/BlogPosting nas páginas auditadas.",
    why: "Distingue conteúdo com autoria e data de uma página comercial — e é o que sustenta uma citação.",
    fix: article ? "" : "Marcar os artigos com Article/BlogPosting incluindo author, datePublished e dateModified.",
    weight: 1,
  });

  const hasBreadcrumb = hasType(nodes, "BreadcrumbList");
  add({
    id: "breadcrumb",
    pillar: "understanding",
    label: "BreadcrumbList",
    status: hasBreadcrumb ? "pass" : "warn",
    detail: hasBreadcrumb ? "Presente." : "Ausente.",
    why: "Dá ao motor a hierarquia do site — onde é que esta página vive dentro do tema.",
    fix: hasBreadcrumb ? "" : "Adicionar BreadcrumbList às páginas internas.",
    weight: 1,
  });

  // ——— 3. EXTRAÇÃO ————————————————————————————————————————
  const allHeads = pages.flatMap((p) => [...p.h1, ...p.h2]);
  const questionHeads = allHeads.filter(isQuestion);
  const qRatio = allHeads.length > 0 ? questionHeads.length / allHeads.length : 0;

  add({
    id: "question-headings",
    pillar: "extraction",
    label: "Títulos em forma de pergunta",
    status: qRatio >= 0.2 ? "pass" : qRatio > 0 ? "warn" : "fail",
    detail: `${questionHeads.length} de ${allHeads.length} títulos (${Math.round(qRatio * 100)}%)${
      questionHeads.length > 0 ? ` — ex.: «${questionHeads[0].slice(0, 70)}»` : ""
    }`,
    why: "Um motor de resposta procura o par pergunta→resposta. Um título que É a pergunta do utilizador torna o parágrafo seguinte citável tal como está.",
    fix:
      qRatio >= 0.2
        ? ""
        : "Reescrever parte dos H2 como as perguntas da tabela de prompts, e responder nas duas primeiras frases por baixo.",
    weight: 3,
  });

  const avgWords = Math.round(
    pages.reduce((s, p) => s + p.wordCount, 0) / Math.max(1, pages.length),
  );
  add({
    id: "depth",
    pillar: "extraction",
    label: "Densidade de conteúdo",
    status: avgWords >= 600 ? "pass" : avgWords >= 250 ? "warn" : "fail",
    detail: `${avgWords} palavras em média nas ${pages.length} página${pages.length === 1 ? "" : "s"} auditada${pages.length === 1 ? "" : "s"}.`,
    why: "Abaixo de ~250 palavras não há material de onde extrair uma resposta; a página é vista mas nunca citada.",
    fix: avgWords >= 600 ? "" : "Desenvolver as páginas de serviço com o processo, contraindicações, duração, preço indicativo e perguntas frequentes.",
    weight: 2,
  });

  const missingAlt = pages.reduce((s, p) => s + p.imagesMissingAlt, 0);
  const totalImgs = pages.reduce((s, p) => s + p.imageCount, 0);
  add({
    id: "alt",
    pillar: "extraction",
    label: "Texto alternativo nas imagens",
    status: totalImgs === 0 ? "warn" : missingAlt === 0 ? "pass" : missingAlt / totalImgs < 0.2 ? "warn" : "fail",
    detail: totalImgs === 0 ? "Sem imagens nas páginas auditadas." : `${missingAlt} de ${totalImgs} imagens sem alt.`,
    why: "Um modelo lê o alt, não a imagem. É a única descrição do que está lá.",
    fix: missingAlt > 0 ? "Preencher o alt das imagens de serviço e equipa com a descrição real, não com a keyword." : "",
    weight: 1,
  });

  const withDesc = pages.filter((p) => (p.metaDescription ?? "").length >= 60).length;
  add({
    id: "meta-desc",
    pillar: "extraction",
    label: "Meta description útil",
    status: withDesc === pages.length ? "pass" : withDesc > 0 ? "warn" : "fail",
    detail: `${withDesc} de ${pages.length} páginas com descrição ≥ 60 caracteres.`,
    why: "É muitas vezes o resumo que o motor usa quando cita a página sem a abrir por inteiro.",
    fix: withDesc === pages.length ? "" : "Escrever uma descrição de 120–155 caracteres que responda, e não que venda.",
    weight: 1,
  });

  const multiH1 = pages.filter((p) => p.h1.length !== 1);
  add({
    id: "h1",
    pillar: "extraction",
    label: "H1 único por página",
    status: multiH1.length === 0 ? "pass" : "warn",
    detail:
      multiH1.length === 0
        ? "Todas as páginas auditadas têm exatamente um H1."
        : `${multiH1.length} página(s) com ${multiH1.map((p) => p.h1.length).join("/")} H1.`,
    why: "O H1 é o rótulo do tema. Zero ou vários deixam o motor a escolher sozinho qual é o assunto.",
    fix: multiH1.length === 0 ? "" : "Deixar um só H1 por página, com o tema em linguagem de utilizador.",
    weight: 1,
  });

  // ——— 4. CONFIANÇA ————————————————————————————————————————
  const person = findWithType(nodes, "Person");
  const authorOnArticle = article && "author" in article;
  add({
    id: "authorship",
    pillar: "trust",
    label: "Autoria identificada",
    status: person || authorOnArticle ? "pass" : "warn",
    detail: person
      ? `Person marcado${typeof person.name === "string" ? `: ${person.name}` : ""}.`
      : authorOnArticle
        ? "Author declarado no Article."
        : "Sem autor marcado.",
    why: "Em saúde, direito e finanças, um motor prefere citar o que tem um responsável com nome e credencial.",
    fix: person || authorOnArticle ? "" : "Marcar os artigos com author → Person (nome, cargo, cédula quando aplicável) e criar as páginas de equipa.",
    weight: 2,
  });

  const dateModified = nodes.find((n) => typeof n.dateModified === "string");
  const modifiedAt = dateModified ? String(dateModified.dateModified) : null;
  const monthsOld = modifiedAt
    ? (Date.now() - new Date(modifiedAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
    : null;
  add({
    id: "freshness",
    pillar: "trust",
    label: "Frescura declarada",
    status:
      monthsOld === null ? "warn" : monthsOld <= 12 ? "pass" : "warn",
    detail:
      monthsOld === null
        ? "Nenhuma página declara dateModified."
        : `Última atualização declarada: ${modifiedAt?.slice(0, 10)} (${Math.round(monthsOld)} meses).`,
    why: "Entre duas fontes equivalentes, a resposta cita a mais recente — e a data que conta é a declarada, não a real.",
    fix: monthsOld !== null && monthsOld <= 12 ? "" : "Declarar dateModified e atualizar as páginas de serviço pelo menos uma vez por ano.",
    weight: 2,
  });

  const orgPhone = org && typeof org.telephone === "string";
  const orgAddr = org && typeof org.address === "object" && org.address !== null;
  add({
    id: "nap",
    pillar: "trust",
    label: "Contacto e morada estruturados",
    status: orgPhone && orgAddr ? "pass" : orgPhone || orgAddr ? "warn" : "fail",
    detail: `${orgPhone ? "telefone" : "sem telefone"} · ${orgAddr ? "morada" : "sem morada"} no schema.`,
    why: "Numa pergunta local, a resposta precisa de um sítio e de um número para poder recomendar. Sem eles cita quem os tem.",
    fix: orgPhone && orgAddr ? "" : "Completar o LocalBusiness com telephone, address (PostalAddress) e openingHoursSpecification.",
    weight: 2,
  });

  const expected = (opts.expectedLang ?? "").slice(0, 2).toLowerCase();
  const pageLang = (homePage.lang ?? "").slice(0, 2).toLowerCase();
  add({
    id: "lang",
    pillar: "trust",
    label: "Língua declarada",
    status: !pageLang ? "fail" : !expected || pageLang === expected ? "pass" : "warn",
    detail: pageLang
      ? `lang="${homePage.lang}"${expected && pageLang !== expected ? ` — esperado ${expected}` : ""}`
      : "Sem atributo lang no <html>.",
    why: "O corpus de respostas é indexado por país E língua. Uma página sem lang, ou com a errada, entra na fila do mercado errado.",
    fix: pageLang && (!expected || pageLang === expected)
      ? ""
      : "Declarar lang no <html> com a língua do mercado, e hreflang quando houver mais do que uma versão.",
    weight: 2,
  });

  const canonicalOk = pages.filter((p) => Boolean(p.canonical)).length;
  add({
    id: "canonical",
    pillar: "trust",
    label: "Canonical e HTTPS",
    status: origin.startsWith("https") && canonicalOk === pages.length ? "pass" : "warn",
    detail: `${origin.startsWith("https") ? "HTTPS" : "sem HTTPS"} · canonical em ${canonicalOk}/${pages.length}.`,
    why: "Duas URLs para o mesmo conteúdo dividem as citações por duas — e nenhuma das duas ganha.",
    fix: origin.startsWith("https") && canonicalOk === pages.length ? "" : "Forçar HTTPS e declarar canonical em todas as páginas.",
    weight: 1,
  });

  // ——— Score ————————————————————————————————————————————
  const value = (s: GeoCheckStatus) =>
    s === "pass" ? 1 : s === "warn" ? 0.5 : 0;
  const scoreOf = (list: GeoCheck[]) => {
    const scored = list.filter((c) => c.status !== "unknown");
    const max = scored.reduce((s, c) => s + c.weight, 0);
    if (max === 0) return 0;
    const got = scored.reduce((s, c) => s + c.weight * value(c.status), 0);
    return Math.round((got / max) * 100);
  };
  const pillars: GeoPillar[] = ["access", "understanding", "extraction", "trust"];

  return {
    checkedOn: new Date().toISOString().slice(0, 10),
    domain,
    unreachable: false,
    pagesAudited: pages.map((p) => p.finalUrl),
    checks,
    score: scoreOf(checks),
    pillarScores: Object.fromEntries(
      pillars.map((p) => [p, scoreOf(checks.filter((c) => c.pillar === p))]),
    ) as Record<GeoPillar, number>,
    bots,
    hasLlmsTxt: hasLlms,
    schemaTypes,
  };
}
