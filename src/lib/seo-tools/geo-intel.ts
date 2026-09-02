// GEO — Generative Engine Optimization. O que a IA responde quando alguém
// pergunta sobre o que este cliente vende, e quem é que ela cita.
//
// PORQUE ISTO É UMA SECÇÃO E NÃO UMA MÉTRICA. O SEO clássico responde a «em
// que lugar aparecemos na página de resultados». Um motor de resposta não
// tem lugares: tem UMA resposta, com três a oito fontes citadas. Ou se está
// lá dentro, ou não se existe. Medir isso é medir três coisas distintas:
//
//   1. O CORPUS — que perguntas é que as pessoas fazem, neste país e nesta
//      língua, sobre os temas do cliente. Sem a lista das perguntas, «estar
//      em IA» é uma opinião.
//   2. A CITAÇÃO — em quantas dessas respostas o domínio do cliente é uma
//      das fontes, e com que peso (ponderado pelo volume de quem pergunta,
//      porque ser citado numa pergunta feita 3000 vezes/mês não é o mesmo
//      que numa feita 10).
//   3. OS RIVAIS — quem ocupa o lugar. Numa resposta de IA a concorrência
//      não é «quem está acima de nós»: é a lista inteira das fontes, que
//      muitas vezes não são sequer concorrentes comerciais (ordens
//      profissionais, jornais, o SNS).
//
// FONTE: DataForSEO `ai_optimization/llm_mentions`, que indexa respostas
// reais de motores generativos por país+língua. Verificado a 12/08/2026:
// Portugal/pt tem 574 686 respostas indexadas (plataforma `google` = AI
// Overview); Brasil/pt tem 6 912 560. Cada item traz a pergunta, o texto da
// resposta, as fontes citadas com URL e posição, o volume de pesquisa IA e
// as `fan_out_queries` — as sub-perguntas que o motor gera sozinho.
//
// ⚠️ A LARGURA DO TÓPICO É TUDO. Medido a 12/08/2026 na mesma base PT:
// «fisioterapia» devolve 48 perguntas, «dentista» devolve 90, e
// «medicina da longevidade» ou «tratamento escoliose lisboa» devolvem ZERO.
// A versão anterior desta integração preferia os tópicos MAIS específicos
// (mais palavras = menos lixo) e por isso quase nunca encontrava nada. Aqui
// a escada é ao contrário: começa-se pela cabeça (uma palavra), que é onde
// o corpus vive, e desce-se para o específico só enquanto houver resposta.

import { getClientGeo } from "@/lib/client-geo";
import { isDataforSeoConfigured } from "./dataforseo";
import { bareDomain } from "./dataforseo-ranks";

const API_BASE = "https://api.dataforseo.com/v3";

/** Quantos tópicos se consultam por relatório. Cada um é um pedido a $0,10
 *  + $0,001 por pergunta devolvida — três tópicos ficam em ~$0,40 por
 *  cliente, que a ~20 clientes/mês são ~$8. */
const MAX_TOPICS = 3;

/** Perguntas por tópico. 25 chega para a tabela do relatório e mantém o
 *  custo por tópico abaixo dos 13 cêntimos. */
const PROMPTS_PER_TOPIC = 25;

/** Perguntas onde o domínio já é citado, sem filtro de tópico. */
const PRESENT_LIMIT = 25;

/** Máximo de perguntas guardadas no snapshot. O KV do relatório não é um
 *  data lake; o total real vai à parte para o número não mentir. */
const MAX_STORED_PROMPTS = 60;

/** Excerto da resposta da IA guardado por pergunta. O texto integral chega
 *  a 4 000 caracteres — três desses por relatório enchiam o KV. */
const ANSWER_EXCERPT_CHARS = 420;

const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type GeoSource = {
  domain: string;
  url: string;
  title: string;
  /** Ordem em que a fonte é citada na resposta. */
  position: number;
};

export type GeoPromptFull = {
  /** "google" (AI Overview), "chat_gpt", … */
  platform: string;
  /** Modelo concreto ("google_ai_overview"). */
  modelName: string;
  question: string;
  /** Excerto da resposta, já limpo de marcadores de citação. */
  answerExcerpt: string;
  /** Pesquisas/mês que despoletam esta resposta. */
  aiSearchVolume: number;
  /** O domínio do cliente é uma das fontes citadas. */
  cited: boolean;
  /** Posição da citação do cliente na lista de fontes (1 = primeira). */
  citedPosition: number | null;
  /** Todas as fontes citadas, por ordem. */
  sources: GeoSource[];
  /** Sub-perguntas que o motor gerou a partir desta — matéria-prima para
   *  briefings de conteúdo. */
  fanOutQueries: string[];
  /** Tópico da nossa escada que trouxe esta pergunta. */
  topic: string;
  /** Quantas palavras do plano de keywords aparecem na pergunta. Um tópico
   *  de cabeça traz o mercado inteiro: «fisioterapia» devolve tanto «quanto
   *  custa uma sessão» como «média de entrada no curso de fisioterapia».
   *  As duas são perguntas reais; só uma é do cliente. Isto ordena-as sem
   *  ter de deitar nenhuma fora. */
  relevance: number;
  /** De quem é a pergunta. Ver `classifyAudience`: um tópico de cabeça traz
   *  o mercado inteiro, e metade do mercado de «fisioterapia» é gente a
   *  escolher licenciatura. */
  audience: "customer" | "context";
  /** Primeira/última vez que a resposta foi vista pelo indexador. */
  firstSeen: string | null;
  lastSeen: string | null;
};

export type GeoCompetitor = {
  domain: string;
  /** Em quantas perguntas do corpus é citado. */
  mentions: number;
  /** Soma do volume das perguntas onde é citado — o peso real. */
  volume: number;
  /** Percentagem do VOLUME do corpus em cujas respostas este domínio é
   *  citado. Não é uma quota que soma 100: numa resposta generativa há
   *  várias fontes citadas ao mesmo tempo, e um corpus onde os cinco
   *  primeiros somam 200% é um corpus onde cinco sites partilham quase
   *  todas as respostas. Chamar-lhe «quota» seria mentir sobre a
   *  aritmética. */
  coverage: number;
  /** É o cliente. */
  isClient: boolean;
};

/** INTENÇÃO. O corpus responde ao TEMA, não ao negócio: pedir «fisioterapia»
 *  em Portugal devolve, na mesma lista, «quanto custa uma sessão» (o
 *  cliente) e «média de entrada em fisioterapia» (um aluno do 12.º). As
 *  duas são perguntas reais e as duas ficam no relatório — mas a segunda
 *  não é mercado deste cliente e não pode contaminar a quota de voz nem
 *  encher a tabela que o cliente lê.
 *
 *  Duas regras, ambas verificáveis a olho na tabela:
 *   • léxico de ensino/profissão/dicionário → contexto;
 *   • função inglesa numa base portuguesa → outro mercado.
 *  Tudo o resto é do cliente. Errar por defeito para «customer» é
 *  deliberado: é preferível uma linha a mais do que esconder uma pergunta
 *  que era mesmo dele. */
const CONTEXT_LEXICON = [
  "curso", "cursos", "licenciatura", "licenciaturas", "mestrado",
  "doutoramento", "faculdade", "universidade", "politecnico", "politécnico",
  "instituto", "ects", "media de entrada", "média de entrada", "candidatura",
  "estagio", "estágio", "salario", "salário", "ordenado", "vencimento",
  "emprego", "empregos", "vagas", "recrutamento", "concurso", "ordem dos",
  "cedula", "cédula", "simbolo", "símbolo", "simbolos", "símbolos",
  "significado", "sinonimo", "sinónimo", "traducao", "tradução", "ingles",
  "inglês", "wikipedia", "definicao", "definição", "quem inventou",
  "abreviatura", "sigla", "formacao", "formação", "certificado", "diploma",
  "curriculo", "currículo", "profissao", "profissão", "carreira", "auxiliar",
  "pos graduacao", "pós-graduação", "pos-graduacao", "graduacao", "graduação",
  "nota de acesso", "media de acesso", "média de acesso", "fisioterapia media",
  "media fisioterapia",
  "tecnico auxiliar", "técnico auxiliar", "course", "courses", "degree",
  "university", "college", "salary", "career", "meaning", "translation",
];

/** Palavras funcionais inglesas: numa base pt, uma pergunta que as use é de
 *  outro mercado que caiu no índice («reformers for pilates»). */
const EN_FUNCTION_WORDS = new Set([
  "for", "with", "and", "the", "of", "your", "best", "near", "what", "how",
  "does", "are", "is", "to", "my", "in", "on", "vs",
]);

function classifyAudience(
  question: string,
  languageCode: string,
): "customer" | "context" {
  const q = fold(question);
  if (CONTEXT_LEXICON.some((w) => q.includes(fold(w)))) return "context";
  if (languageCode.startsWith("pt")) {
    const words = q.split(/[^a-z0-9]+/);
    if (words.some((w) => EN_FUNCTION_WORDS.has(w))) return "context";
  }
  return "customer";
}

export type GeoTopicCoverage = {
  topic: string;
  prompts: number;
  volume: number;
  cited: number;
  citedVolume: number;
};

/** Volume de pesquisa EM IA de uma target keyword — quantas vezes por mês a
 *  keyword é perguntada a um motor generativo, não a uma caixa de pesquisa.
 *  É a métrica que diz se vale a pena trabalhar a keyword para GEO. */
export type GeoKeywordVolume = {
  keyword: string;
  aiSearchVolume: number;
  /** 12 meses, mais recente primeiro, tal como a API devolve. */
  history: number[];
};

export type GeoIntel = {
  checkedOn: string;
  domain: string;
  locationCode: number;
  languageCode: string;
  countryLabel: string;
  /** Plataformas onde há corpus para este país+língua. */
  platforms: string[];
  topics: GeoTopicCoverage[];
  /** As perguntas, ordenadas por volume. Inclui as citadas e as não citadas
   *  — a secção é sobre o mercado inteiro, não sobre as vitórias. */
  prompts: GeoPromptFull[];
  /** Perguntas DO CLIENTE encontradas (as de contexto ficam à parte). */
  promptsTotal: number;
  /** Quantas delas citam o cliente. */
  promptsCited: number;
  /** Perguntas do mesmo tema que não são mercado deste cliente — ensino,
   *  profissão, dicionário, outro país. Ficam guardadas e visíveis na vista
   *  interna, fora de todas as contas. */
  contextPrompts: number;
  contextVolume: number;
  /** Volume somado de todas as perguntas / das que nos citam. */
  volumeTotal: number;
  volumeCited: number;
  /** Quota de voz em IA: volumeCited / volumeTotal × 100. */
  shareOfVoice: number;
  competitors: GeoCompetitor[];
  /** Sub-perguntas mais frequentes em todo o corpus. */
  fanOut: { query: string; count: number }[];
  /** Volume IA das target keywords do plano. */
  keywordVolumes: GeoKeywordVolume[];
  costUsd: number;
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

type RawSource = {
  domain?: string;
  url?: string;
  title?: string;
  position?: number;
};

type RawItem = {
  platform?: string;
  model_name?: string;
  question?: string;
  answer?: string;
  ai_search_volume?: number;
  sources?: RawSource[];
  fan_out_queries?: string[];
  first_response_at?: string;
  last_response_at?: string;
};

type RawTask = {
  status_code?: number;
  status_message?: string;
  result?: { total_count?: number; items?: RawItem[] }[];
};

function auth(): string {
  return Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");
}

async function callDfs(
  path: string,
  body: unknown,
): Promise<{ task: RawTask | undefined; cost: number }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `DataForSEO HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`,
    );
  }
  const json = (await res.json()) as { cost?: number; tasks?: RawTask[] };
  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code >= 40000) {
    throw new Error(`DataForSEO ${task.status_code} ${task.status_message ?? ""}`);
  }
  return { task, cost: json.cost ?? 0 };
}

/** A resposta vem em markdown com marcadores de citação `[[3]](url)` e
 *  crases a marcar a frase-resposta. Nada disso se lê num relatório. */
function cleanAnswer(raw: string): string {
  return raw
    .replace(/\[\[?\d+\]?\]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(s: string, max = ANSWER_EXCERPT_CHARS): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut).trim() + "…";
}

// ---------------------------------------------------------------------------
// Escada de tópicos
// ---------------------------------------------------------------------------

/** Palavras que não são tópico: ligação, e as cidades onde a carteira opera.
 *  Uma cidade é um excelente qualificador de SEO local e um péssimo tópico
 *  de IA — ninguém pergunta a um motor «fisioterapia belém lisboa». */
const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "a", "o",
  "as", "os", "e", "com", "para", "por", "um", "uma", "que", "the", "in",
  "of", "for", "and", "best", "melhor", "melhores", "preco", "precos",
  "preço", "preços", "perto", "mim", "onde", "como", "qual", "quanto",
  "lisboa", "porto", "cascais", "belem", "belém", "restelo", "estoril",
  "oeiras", "sintra", "amadora", "almada", "london", "lisbon", "uk",
  "portugal", "brasil", "conde", "vila", "near", "me",
  // Localizações dos mercados dos clientes internacionais. «brighton» como
  // tópico devolve o corpus de Brighton (pavilhão real, meteorologia…), e
  // «united kingdom» devolve o do país inteiro — nada disso é do cliente.
  // A lição do Kings Gyms (v77.2): um qualificador local NUNCA é um tópico.
  "united", "kingdom", "britain", "england", "scotland", "wales",
  "brighton", "croydon", "mitcham", "crawley", "manchester", "bristol",
  "birmingham", "leeds", "liverpool", "glasgow", "edinburgh",
  "toronto", "vancouver", "montreal", "ottawa", "calgary",
  "sydney", "melbourne", "brisbane", "perth", "adelaide",
]);

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** A ESCADA. Uma palavra primeiro, duas depois — o inverso da versão
 *  anterior, e a razão pela qual esta encontra corpus onde aquela via
 *  zeros. As palavras vêm ordenadas por quantas target keywords as contêm:
 *  a palavra que aparece em metade do plano É o tema do cliente.
 *
 *  Exportada para poder ser testada sem gastar chamadas. */
export function topicLadder(
  keywords: string[],
  max = MAX_TOPICS,
  /** Tokens extra a excluir — o país/mercado do cliente (ex.: "united",
   *  "kingdom"), para nenhum tópico ser um nome de sítio. */
  extraStop?: Set<string>,
): string[] {
  const heads = new Map<string, number>();
  const pairs = new Map<string, number>();

  for (const kw of keywords) {
    const words = fold(kw)
      .split(/[^a-z0-9]+/)
      .filter(
        (w) => w.length > 3 && !STOPWORDS.has(w) && !extraStop?.has(w),
      );
    // Um tópico de uma palavra só tem de ser uma palavra do DOMÍNIO
    // («fisioterapia», «longevidade»), não um adjetivo qualquer que calhou
    // na cauda: «desportiva» ou «saudável» sozinhas trazem um corpus que
    // não é do cliente. Seis letras é o corte que separa umas das outras
    // sem ter de manter uma lista de exceções por setor.
    for (const w of words) {
      if (w.length >= 6) heads.set(w, (heads.get(w) ?? 0) + 1);
    }
    for (let i = 0; i < words.length - 1; i++) {
      const p = `${words[i]} ${words[i + 1]}`;
      pairs.set(p, (pairs.get(p) ?? 0) + 1);
    }
  }

  // Frequência primeiro (a palavra que aparece em metade do plano É o tema),
  // e o desempate é pelo comprimento: entre duas palavras igualmente
  // frequentes, a mais longa é a mais específica do setor.
  const byFreq = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort(
        (a, b) =>
          b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]),
      )
      .map(([t]) => t);

  const out: string[] = [];
  const headList = byFreq(heads);
  const pairList = byFreq(pairs);
  // Duas cabeças no máximo antes de descer a um par: duas cabeças cobrem o
  // tema, três começam a repetir o mesmo corpus.
  for (const h of headList.slice(0, Math.max(1, max - 1))) out.push(h);
  for (const p of pairList) {
    if (out.length >= max) break;
    // Um par que só repete uma cabeça já consultada não traz corpus novo.
    if (out.some((t) => p.startsWith(`${t} `) || p.endsWith(` ${t}`))) continue;
    out.push(p);
  }
  for (const h of headList) {
    if (out.length >= max) break;
    if (!out.includes(h)) out.push(h);
  }
  return out.slice(0, max);
}

// ---------------------------------------------------------------------------
// Recolha
// ---------------------------------------------------------------------------

function mapItem(
  it: RawItem,
  domain: string,
  topic: string,
  planTokens: Set<string>,
  languageCode: string,
): GeoPromptFull {
  const sources: GeoSource[] = (it.sources ?? [])
    .map((s) => ({
      domain: bareDomain(s.domain ?? ""),
      url: s.url ?? "",
      title: (s.title ?? "").trim(),
      position: s.position ?? 0,
    }))
    .filter((s) => s.domain);
  const hit = sources.find(
    (s) => s.domain === domain || s.domain.endsWith(`.${domain}`),
  );
  const question = (it.question ?? "").trim();
  const qTokens = new Set(
    fold(question)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
  let relevance = 0;
  for (const t of qTokens) if (planTokens.has(t)) relevance += 1;

  return {
    platform: it.platform ?? "—",
    modelName: it.model_name ?? "",
    question,
    answerExcerpt: excerpt(cleanAnswer(it.answer ?? "")),
    aiSearchVolume: it.ai_search_volume ?? 0,
    cited: Boolean(hit),
    citedPosition: hit ? hit.position : null,
    sources,
    fanOutQueries: (it.fan_out_queries ?? []).filter(Boolean).slice(0, 8),
    topic,
    relevance,
    audience: classifyAudience(question, languageCode),
    firstSeen: it.first_response_at ?? null,
    lastSeen: it.last_response_at ?? null,
  };
}

async function searchPrompts(
  topic: string,
  locationCode: number,
  languageCode: string,
  limit: number,
): Promise<{ total: number; items: RawItem[]; cost: number }> {
  const { task, cost } = await callDfs(
    "/ai_optimization/llm_mentions/search/live",
    [
      {
        target: [
          {
            keyword: topic,
            search_filter: "include",
            search_scope: ["question"],
            match_type: "partial_match",
          },
        ],
        location_code: locationCode,
        language_code: languageCode,
        order_by: ["ai_search_volume,desc"],
        limit,
      },
    ],
  );
  const r = task?.result?.[0];
  return { total: r?.total_count ?? 0, items: r?.items ?? [], cost };
}

/** Perguntas onde o domínio já é citado, em QUALQUER tema. Sem filtro de
 *  tópico de propósito: a pergunta aqui é «onde é que este domínio é
 *  citado», não «onde é citado sobre X» — e a resposta surpreende, porque
 *  quase sempre inclui temas que ninguém trabalhou. */
async function searchOwnMentions(
  domain: string,
  locationCode: number,
  languageCode: string,
): Promise<{ total: number; items: RawItem[]; cost: number }> {
  const { task, cost } = await callDfs(
    "/ai_optimization/llm_mentions/search_mentions/live",
    [
      {
        target: [{ domain, search_filter: "include", search_scope: ["any"] }],
        location_code: locationCode,
        language_code: languageCode,
        order_by: ["ai_search_volume,desc"],
        limit: PRESENT_LIMIT,
      },
    ],
  );
  const r = task?.result?.[0];
  return { total: r?.total_count ?? 0, items: r?.items ?? [], cost };
}

type RawVolItem = {
  keyword?: string;
  ai_search_volume?: number;
  ai_monthly_searches?: { ai_search_volume?: number }[];
};

/** Volume de pesquisa em IA das target keywords. Barato ($0,01 + $0,0001
 *  por keyword) e é a única forma de saber se o plano de SEO clássico e o
 *  que as pessoas perguntam à IA são sequer a mesma lista. */
async function fetchKeywordVolumes(
  keywords: string[],
  locationCode: number,
  languageCode: string,
): Promise<{ rows: GeoKeywordVolume[]; cost: number }> {
  if (keywords.length === 0) return { rows: [], cost: 0 };
  const { task, cost } = await callDfs(
    "/ai_optimization/ai_keyword_data/keywords_search_volume/live",
    [
      {
        keywords: keywords.slice(0, 100),
        location_code: locationCode,
        language_code: languageCode,
      },
    ],
  );
  const items = (task?.result?.[0] as { items?: RawVolItem[] } | undefined)?.items ?? [];
  return {
    rows: items.map((it) => ({
      keyword: it.keyword ?? "",
      aiSearchVolume: it.ai_search_volume ?? 0,
      history: (it.ai_monthly_searches ?? []).map((m) => m.ai_search_volume ?? 0),
    })),
    cost,
  };
}

/** True quando vale a pena desenhar a secção. Sem corpus nenhum, uma grelha
 *  de zeros lê-se como trabalho não feito e não como um mercado que ainda
 *  não existe — mas a auditoria de prontidão (geo-readiness) desenha-se na
 *  mesma, porque essa tem sempre resposta. */
export function hasGeoIntelSignal(intel: GeoIntel | null): boolean {
  if (!intel) return false;
  return (
    intel.promptsTotal > 0 ||
    intel.keywordVolumes.some((k) => k.aiSearchVolume > 0)
  );
}

export async function fetchGeoIntel(
  slug: string,
  website: string,
  keywords: string[],
): Promise<GeoIntel | null> {
  if (!isDataforSeoConfigured()) return null;
  const domain = bareDomain(website);
  if (!domain) return null;

  const geo = getClientGeo(slug);
  // O país do cliente nunca pode virar tópico nem contar como relevância —
  // «united kingdom» no plano do Kings Gyms trazia o corpus do país inteiro.
  const geoStop = new Set(
    fold(geo.countryLabel)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
  const topics = topicLadder(keywords, MAX_TOPICS, geoStop);
  // O vocabulário do plano — usado para pontuar quão «nossa» é cada pergunta
  // que o corpus devolve.
  const planTokens = new Set(
    keywords.flatMap((k) =>
      fold(k)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !geoStop.has(w)),
    ),
  );
  let costUsd = 0;

  // Tudo em paralelo: são pedidos independentes e o relatório inteiro tem
  // orçamento de tempo. Qualquer um pode falhar sem levar os outros.
  const [topicResults, ownRes, volRes] = await Promise.all([
    Promise.all(
      topics.map(async (topic) => {
        const r = await searchPrompts(
          topic,
          geo.locationCode,
          geo.languageCode,
          PROMPTS_PER_TOPIC,
        ).catch((err) => {
          console.error(`GEO prompts «${topic}» falhou:`, err);
          return null;
        });
        return { topic, r };
      }),
    ),
    searchOwnMentions(domain, geo.locationCode, geo.languageCode).catch((err) => {
      console.error("GEO menções próprias falhou:", err);
      return null;
    }),
    fetchKeywordVolumes(keywords, geo.locationCode, geo.languageCode).catch(
      (err) => {
        console.error("GEO volumes IA falhou:", err);
        return null;
      },
    ),
  ]);

  // Uma pergunta pode vir por dois tópicos — fica a primeira, que é a do
  // tópico mais forte (a escada consulta por ordem de frequência).
  const byQuestion = new Map<string, GeoPromptFull>();
  const topicCoverage: GeoTopicCoverage[] = [];

  for (const { topic, r } of topicResults) {
    if (!r) continue;
    costUsd += r.cost;
    let volume = 0;
    let cited = 0;
    let citedVolume = 0;
    for (const raw of r.items) {
      const p = mapItem(raw, domain, topic, planTokens, geo.languageCode);
      if (!p.question) continue;
      if (p.audience === "customer") volume += p.aiSearchVolume;
      if (p.cited) {
        cited += 1;
        citedVolume += p.aiSearchVolume;
      }
      const key = fold(p.question);
      if (!byQuestion.has(key)) byQuestion.set(key, p);
    }
    topicCoverage.push({
      topic,
      prompts: r.total,
      volume,
      cited,
      citedVolume,
    });
  }

  // As perguntas onde já somos citados entram no mesmo saco. Vêm de um
  // pedido sem tópico, por isso trazem temas que a escada nunca tocaria —
  // e são exatamente as que o cliente mais gosta de ver.
  if (ownRes) {
    costUsd += ownRes.cost;
    for (const raw of ownRes.items) {
      const p = mapItem(raw, domain, "—", planTokens, geo.languageCode);
      // Uma pergunta onde já somos fonte é do cliente por definição — foi a
      // IA que decidiu que este negócio responde àquilo.
      p.audience = "customer";
      if (!p.question) continue;
      // O endpoint filtra por menção, por isso é citada por construção,
      // mesmo que a fonte venha por um subdomínio que o match não apanhe.
      p.cited = true;
      const key = fold(p.question);
      const prev = byQuestion.get(key);
      if (!prev || !prev.cited) byQuestion.set(key, p);
    }
  }

  // Ordem da tabela: primeiro onde já somos citados (é a prova de que isto
  // funciona), depois o que é mais nosso, e só então o volume. Ordenar por
  // volume puro punha «curso de fisioterapia» no topo do relatório de uma
  // clínica que não dá cursos.
  const all = Array.from(byQuestion.values()).sort(
    (a, b) =>
      Number(a.audience === "context") - Number(b.audience === "context") ||
      Number(b.cited) - Number(a.cited) ||
      b.relevance - a.relevance ||
      b.aiSearchVolume - a.aiSearchVolume ||
      a.question.localeCompare(b.question, "pt"),
  );

  // —— Quem ocupa o lugar ————————————————————————————————————
  // Ponderado pelo volume, não pela contagem: ser citado numa pergunta feita
  // 3000 vezes/mês não é o mesmo que numa feita 10, e uma tabela por
  // contagem faz um blog obscuro parecer um líder de mercado.
  const compMap = new Map<string, { mentions: number; volume: number }>();
  let volumeTotal = 0;
  let volumeCited = 0;
  let contextPrompts = 0;
  let contextVolume = 0;
  for (const p of all) {
    if (p.audience === "context") {
      contextPrompts += 1;
      contextVolume += p.aiSearchVolume;
      continue;
    }
    volumeTotal += p.aiSearchVolume;
    if (p.cited) volumeCited += p.aiSearchVolume;
    const seen = new Set<string>();
    for (const s of p.sources) {
      if (seen.has(s.domain)) continue;
      seen.add(s.domain);
      const cur = compMap.get(s.domain) ?? { mentions: 0, volume: 0 };
      cur.mentions += 1;
      cur.volume += p.aiSearchVolume;
      compMap.set(s.domain, cur);
    }
  }
  const competitors: GeoCompetitor[] = Array.from(compMap.entries())
    .map(([d, v]) => ({
      domain: d,
      mentions: v.mentions,
      volume: v.volume,
      coverage: volumeTotal > 0 ? (v.volume / volumeTotal) * 100 : 0,
      isClient: d === domain || d.endsWith(`.${domain}`),
    }))
    .sort((a, b) => b.volume - a.volume || b.mentions - a.mentions)
    .slice(0, 15);

  // —— Sub-perguntas ————————————————————————————————————————
  const customersForFanOut = all.filter((p) => p.audience === "customer");
  const fanMap = new Map<string, number>();
  for (const p of customersForFanOut) {
    for (const q of p.fanOutQueries) {
      const key = q.trim().toLowerCase();
      if (!key) continue;
      fanMap.set(key, (fanMap.get(key) ?? 0) + 1);
    }
  }
  const fanOut = Array.from(fanMap.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count || a.query.localeCompare(b.query, "pt"))
    .slice(0, 24);

  if (volRes) costUsd += volRes.cost;

  const customers = all.filter((p) => p.audience === "customer");
  const promptsCited = customers.filter((p) => p.cited).length;

  return {
    checkedOn: new Date().toISOString().slice(0, 10),
    domain,
    locationCode: geo.locationCode,
    languageCode: geo.languageCode,
    countryLabel: geo.countryLabel,
    platforms: Array.from(new Set(all.map((p) => p.platform))).filter(Boolean),
    topics: topicCoverage,
    prompts: all.slice(0, MAX_STORED_PROMPTS),
    promptsTotal: customers.length,
    promptsCited,
    contextPrompts,
    contextVolume,
    volumeTotal,
    volumeCited,
    shareOfVoice: volumeTotal > 0 ? (volumeCited / volumeTotal) * 100 : 0,
    competitors,
    fanOut,
    keywordVolumes: (volRes?.rows ?? [])
      .filter((k) => k.aiSearchVolume > 0)
      .sort((a, b) => b.aiSearchVolume - a.aiSearchVolume),
    costUsd: Math.round(costUsd * 10000) / 10000,
  };
}
