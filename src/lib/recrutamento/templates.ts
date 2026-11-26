// Recrutamento (v80.13) — os templates das entrevistas.
//
// Cada entrevista nasce de um template e guarda o id e a versão dele: mudar
// um template não reescreve as entrevistas já feitas. O texto é o do guião do
// André («Entrevista Analista de SEO WonderAds — Fase 2 Parte 1», PDF de
// 20/11/2026), transcrito tal e qual. NUNCA inventar perguntas nem critérios
// (ver a memória «never author training content»): um template novo vem
// sempre de um guião dado pela direção.

import type { MaterialId } from "./materials";

export type SectionId = "hard" | "coach" | "soft" | "detail" | "questions" | "pessoal" | "condicoes" | "percurso";

/** Campo do perfil do candidato que uma pergunta preenche ao vivo (Fase 1,
 *  v80.22): o que se escreve no ecrã da pergunta fica logo na ficha. */
export type ProfileLink = "salary" | "location" | "experience" | "education" | "interests";

export type Criterion = {
  id: string;
  label: string;
  pts: number;
  /** Onde está, para o entrevistador (o teste de detalhe, v80.55). */
  hint?: string;
};

/** O que corta a nota de uma pergunta além dos ✓. */
export type Penalty =
  | { kind: "minus"; id: string; label: string; pts: number }
  | { kind: "cap"; id: string; label: string; max: number };

/** Material de apoio que aparece por baixo da pergunta (o exercício da
 *  Coachability, por exemplo). Só texto, já com a ordem certa. */
export type ScriptBlock =
  | { kind: "step"; label: string; text: string }
  | { kind: "list"; title?: string; items: string[]; answer?: string }
  | { kind: "note"; text: string };

export type Question = {
  id: string;
  section: SectionId;
  /** Código curto para a navegação (H1, S3, …). */
  code: string;
  title: string;
  /** A pergunta a fazer ao candidato (o realce amarelo do guião). */
  prompt: string;
  script?: ScriptBlock[];
  criteria: Criterion[];
  penalties: Penalty[];
  /** Cabeçalho da primeira coluna da tabela («O que procurar», …). */
  criteriaLabel?: string;
  /** Pergunta sem pontuação — só notas; fora das contas (secção Pessoal,
   *  v80.17). */
  unscored?: true;
  /** O campo do perfil que esta pergunta preenche (v80.22). */
  profile?: ProfileLink;
  /** Os PDFs de apoio (o teste de detalhe, v80.55 — lib/recrutamento/materials). */
  materials?: MaterialId[];
};

export type ZoneLabels = { low: string; mid: string; high: string };

export type InterviewTemplate = {
  id: string;
  version: number;
  /** «screening» = conversa de triagem (Fase 1): sem pontos nem grade; o
   *  fecho é um só ecrã, «avança para a Fase 2?». Omisso = entrevista com
   *  pontuação, Fit/Técnica e grade D–A. */
  kind?: "screening";
  title: string;
  /** A vaga que aparece no cabeçalho («Consultor de SEO»). */
  role: string;
  phase: string;
  opening: string[];
  scoringNote: string;
  sections: Array<{ id: SectionId; label: string; short: string }>;
  questions: Question[];
  /** Só nas entrevistas com pontuação. */
  fit?: { label: string; signals: string; zones: ZoneLabels };
  tech?: { label: string; signals: string; zones: ZoneLabels };
};

const RF = (label: string, pts = 3): Penalty => ({ kind: "minus", id: "rf", label, pts });

/** As perguntas da vida pessoal que tocam no art. 17.º/24.º do Código do
 *  Trabalho (vida privada, situação familiar, religião) — o André escolheu
 *  mantê-las com esta nota (20/11/2026). */
const SO_SE_QUISER: ScriptBlock[] = [
  { kind: "note", text: "Só se o candidato quiser responder — não conta para a decisão." },
];

const pessoal = (id: string, code: string, title: string, prompt: string, sensitive = false): Question => ({
  id,
  section: "pessoal",
  code,
  title,
  prompt,
  ...(sensitive ? { script: SO_SE_QUISER } : {}),
  criteria: [],
  penalties: [],
  unscored: true,
});

const SEO_FASE2_P1: InterviewTemplate = {
  id: "seo-analista-fase2-p1",
  // v2 (v80.17): + secção Pessoal no fim, pedida pelo André.
  version: 2,
  title: "Entrevista Analista de SEO WonderAds",
  role: "Consultor de SEO",
  phase: "Fase 2 · Parte 1",
  opening: [
    "Apresentar quem sou e quem é a WonderAds.",
    "Explicar a estrutura: hard skills → coachability → soft skills → teste de atenção ao detalhe → perguntas do candidato.",
  ],
  scoringNote: "Soma os pontos dos critérios ✓. Red flag = −3 (mínimo 0).",
  sections: [
    { id: "hard", label: "Hard Skills", short: "Hard" },
    { id: "coach", label: "Coachability", short: "Coach" },
    { id: "soft", label: "Soft Skills", short: "Soft" },
    { id: "detail", label: "Atenção ao detalhe", short: "Detalhe" },
    { id: "questions", label: "Perguntas do candidato", short: "Perguntas" },
    { id: "pessoal", label: "Pessoal", short: "Pessoal" },
  ],
  questions: [
    // ── Hard Skills ─────────────────────────────────────────────────────
    {
      id: "h1",
      section: "hard",
      code: "H1",
      title: "Experiência com projetos e roadmaps de SEO",
      prompt: "Qual é a tua experiência com projetos de SEO e criação de roadmaps de SEO?",
      criteria: [
        { id: "a", label: "Dá exemplos concretos de projetos (tipo de cliente, dimensão)", pts: 2 },
        { id: "b", label: "Explica como prioriza o roadmap (impacto vs esforço)", pts: 2 },
        { id: "c", label: "Liga o roadmap a objetivos de negócio (leads, vendas), não só rankings", pts: 2 },
        { id: "d", label: "Divide em fases com prazos (ex.: 3, 6, 12 meses)", pts: 2 },
        { id: "e", label: "Mostra resultados com números", pts: 2 },
      ],
      penalties: [RF("Só fala de tarefas soltas («fazia artigos») sem plano, ou não sabe os números dos projetos.")],
    },
    {
      id: "h2",
      section: "hard",
      code: "H2",
      title: "Auditoria SEO num cliente novo",
      prompt:
        "Descreve o teu processo de auditoria SEO num cliente novo, do dia 0 à apresentação de recomendações. O que priorizar nas primeiras duas semanas e porquê?",
      criteria: [
        { id: "a", label: "Começa por perceber o negócio, objetivos e KPIs do cliente", pts: 2 },
        { id: "b", label: "Pede acessos e dados: Search Console, GA4, histórico", pts: 1 },
        { id: "c", label: "Técnico: crawl, indexação, velocidade, mobile", pts: 2 },
        { id: "d", label: "Conteúdo e on-page: páginas existentes, canibalização, lacunas", pts: 1 },
        { id: "e", label: "Olha para backlinks e concorrentes", pts: 1 },
        { id: "f", label: "Prioriza por impacto vs esforço, com quick wins nas 2 semanas", pts: 2 },
        { id: "g", label: "Apresenta poucas recomendações priorizadas, não uma lista de 200 erros", pts: 1 },
      ],
      penalties: [RF("Começa a produzir conteúdo antes de auditar, ou entrega o relatório da ferramenta sem prioridades.")],
    },
    {
      id: "h3",
      section: "hard",
      code: "H3",
      title: "GEO",
      prompt: "O que é GEO e como o abordamos na prática? O que muda em relação a SEO tradicional?",
      criteria: [
        { id: "a", label: "Define bem: aparecer e ser citado nas respostas de IA (ChatGPT, Gemini, AI Overviews, Perplexity)", pts: 2 },
        { id: "b", label: "Conteúdo com respostas diretas e bem estruturado, fácil de citar", pts: 2 },
        { id: "c", label: "Autoridade da marca: menções, reviews, presença em fontes de terceiros", pts: 2 },
        { id: "d", label: "Dados estruturados (schema) e informação consistente em todo o lado", pts: 1 },
        { id: "e", label: "Sabe medir: testes de prompts, menções/citações, tráfego vindo de IA", pts: 2 },
        { id: "f", label: "Diferença para SEO: o objetivo é ser citado, não só clicado", pts: 1 },
      ],
      penalties: [RF("Diz que «é igual a SEO», não sabe o que é, ou promete resultados garantidos.")],
    },
    {
      id: "h4",
      section: "hard",
      code: "H4",
      title: "Meta Tags (partilha de ecrã)",
      prompt: "Partilha o ecrã e mostra-me o que são Meta Tags numa pesquisa.",
      criteria: [
        { id: "a", label: "Mostra o title e a meta description num resultado do Google", pts: 2 },
        { id: "b", label: "Abre o código-fonte ou o Inspecionar e encontra as tags", pts: 2 },
        { id: "c", label: "Sabe boas práticas: tamanho, keyword, texto que dá vontade de clicar", pts: 2 },
        { id: "d", label: "Sabe que o Google pode reescrever a description", pts: 1 },
        { id: "e", label: "Fala de outras tags: robots/noindex, canonical, Open Graph", pts: 2 },
        { id: "f", label: "Faz tudo com à-vontade, sem hesitar", pts: 1 },
      ],
      penalties: [RF("Acha que a meta keywords ainda conta para rankings.")],
    },
    {
      id: "h5",
      section: "hard",
      code: "H5",
      title: "Keyword research num nicho novo",
      prompt:
        "Descreve o teu processo de keyword research do zero num nicho novo, por exemplo dispositivos médicos B2B em Portugal.",
      criteria: [
        { id: "a", label: "Começa pelo cliente: produtos, quem compra (hospitais, clínicas, compras), ciclo de venda", pts: 2 },
        { id: "b", label: "Junta ideias de várias fontes: cliente, concorrentes, catálogos, Search Console", pts: 1 },
        { id: "c", label: "Usa ferramentas e sabe que em PT os volumes são baixos e pouco fiáveis", pts: 2 },
        { id: "d", label: "Separa por intenção (informativa vs comercial) e fase do funil", pts: 2 },
        { id: "e", label: "Pensa em termos técnicos, PT vs EN, nomes de produtos", pts: 1 },
        { id: "f", label: "Agrupa em temas (clusters) e liga cada grupo a uma página", pts: 2 },
      ],
      penalties: [RF("Escolhe keywords só pelo volume, ou ignora que é B2B.")],
    },
    {
      id: "h6",
      section: "hard",
      code: "H6",
      title: "Link building",
      prompt: "Qual é a tua abordagem atual a link building? Que táticas usas, quais evitas, e porquê?",
      criteria: [
        { id: "a", label: "Táticas de qualidade: digital PR, conteúdo que merece links, parcerias, diretórios do setor, menções sem link", pts: 3 },
        { id: "b", label: "Relevância e autoridade acima de quantidade", pts: 2 },
        { id: "c", label: "Evita PBNs e compra de links em massa, e explica o risco para o cliente", pts: 2 },
        { id: "d", label: "Anchor text natural e variado", pts: 1 },
        { id: "e", label: "Sabe como acompanhar e medir os links", pts: 2 },
      ],
      penalties: [RF("Compra links sem critério e acha normal.")],
    },
    {
      id: "h7",
      section: "hard",
      code: "H7",
      title: "Local SEO para 3 clínicas",
      prompt: "Como abordas local SEO e Google Business Profile para uma clínica com 3 unidades em Lisboa, Cascais e Porto?",
      criteria: [
        { id: "a", label: "Um Google Business Profile por unidade", pts: 2 },
        { id: "b", label: "Nome, morada e telefone iguais em todo o lado (NAP)", pts: 1 },
        { id: "c", label: "Uma página no site por unidade, com conteúdo próprio", pts: 2 },
        { id: "d", label: "Estratégia de reviews: pedir e responder", pts: 2 },
        { id: "e", label: "GBP completo: categorias, serviços, fotos, posts", pts: 1 },
        { id: "f", label: "Schema local e diretórios de saúde", pts: 1 },
        { id: "g", label: "Mede: chamadas, pedidos de direções, rankings por cidade", pts: 1 },
      ],
      penalties: [RF("Uma só ficha ou uma só página para as 3 unidades, ou sugere reviews falsas.")],
    },
    {
      id: "h8",
      section: "hard",
      code: "H8",
      title: "Análise de concorrentes",
      prompt:
        "Como analisas competidores? Descreve as ferramentas e o processo, mas mais importante: o que procuras que outros não vêem?",
      criteria: [
        { id: "a", label: "Separa concorrentes de negócio e concorrentes nas pesquisas", pts: 2 },
        { id: "b", label: "Nomeia ferramentas e também olha para o Google à mão", pts: 1 },
        { id: "c", label: "Faz keyword gap e content gap", pts: 2 },
        { id: "d", label: "Analisa os backlinks deles", pts: 1 },
        { id: "e", label: "Vê a estrutura do site e os tipos de página que ganham", pts: 1 },
        { id: "f", label: "«O que outros não vêem»: como convertem, a oferta, onde são fracos, como aparecem em IA", pts: 3 },
      ],
      penalties: [RF("A estratégia é só copiar o que os concorrentes fazem.")],
    },
    // ── Coachability ────────────────────────────────────────────────────
    {
      id: "c1",
      section: "coach",
      code: "C",
      title: "Coachability",
      prompt: "Clínica nova, 2 semanas de trabalho. Ordena estas 5 tarefas por prioridade e explica porquê.",
      script: [
        {
          kind: "list",
          title: "1. Pedir",
          items: [
            "Escrever 10 artigos para o blog",
            "Corrigir um noindex na página de serviços",
            "Criar o Google Business Profile",
            "Baixar o tempo de carregamento de 3,1s para 2,5s",
            "Conseguir links de diretórios de saúde",
          ],
          answer: "2 → 3 → 5 → 4 → 1",
        },
        { kind: "step", label: "2. Erro típico", text: "Começa pelos artigos ou pela velocidade, porque é o que «parece SEO»." },
        {
          kind: "step",
          label: "3. Corrigir e ensinar",
          text: "«Prioriza por impacto × esforço. Primeiro o que está a bloquear resultados: o noindex leva 5 minutos e sem isso a página principal nem aparece no Google. Numa clínica, o GBP traz chamadas mais depressa do que o blog.»",
        },
        {
          kind: "list",
          title: "4. Pedir para repetir com outra lista, num cliente diferente: «Loja online de óculos em Lisboa. Ordena.»",
          items: [
            "Reescrever as descrições de 500 produtos",
            "O robots.txt está a bloquear /categorias/",
            "Adicionar schema de produto",
            "Lançar uma campanha de digital PR",
            "Corrigir 40 links internos partidos",
          ],
          answer: "2 → 5 → 3 → 1 → 4",
        },
        {
          kind: "note",
          text: "Exemplo: pedir title + meta description para uma clínica dentária em Cascais. Corrigir (ex.: falta a localização ou o CTA) e pedir para refazer.",
        },
      ],
      criteria: [
        { id: "a", label: "Ouve a correção sem interromper nem justificar-se", pts: 3 },
        { id: "b", label: "Faz uma pergunta para perceber melhor", pts: 2 },
        { id: "c", label: "Aplica a correção na repetição", pts: 3 },
        { id: "d", label: "Admite o erro com naturalidade", pts: 2 },
      ],
      penalties: [RF("Dá desculpas, discute ou culpa o cenário.")],
    },
    // ── Soft Skills ─────────────────────────────────────────────────────
    {
      id: "s1",
      section: "soft",
      code: "S1",
      title: "Colega a mentir ou a falhar",
      prompt: "Encontraste um colega a mentir ou a falhar num entregável. O que fazes?",
      criteria: [
        { id: "a", label: "Fala primeiro diretamente com o colega, em privado", pts: 3 },
        { id: "b", label: "Frontal e transparente, sem rodeios", pts: 2 },
        { id: "c", label: "Foco em resolver o entregável e proteger o cliente", pts: 2 },
        { id: "d", label: "Se não resolver ou for grave, escala", pts: 2 },
        { id: "e", label: "Sem drama nem conversas pelas costas", pts: 1 },
      ],
      penalties: [RF("Ignora, encobre, ou vai logo à chefia sem falar com o colega.")],
    },
    {
      id: "s2",
      section: "soft",
      code: "S2",
      title: "Discordância técnica com um cliente",
      prompt:
        "Descreve uma situação em que discordaste tecnicamente de um cliente. Como conduziste a conversa e qual foi o resultado?",
      criteria: [
        { id: "a", label: "Exemplo real e concreto", pts: 2 },
        { id: "b", label: "Usou dados na conversa", pts: 3 },
        { id: "c", label: "Ouviu e percebeu o lado do cliente (empatia)", pts: 2 },
        { id: "d", label: "Cedeu onde fazia sentido", pts: 2 },
        { id: "e", label: "Diz qual foi o resultado", pts: 1 },
      ],
      penalties: [RF("«Convenci-o que estava errado», ou cedeu em tudo.")],
    },
    {
      id: "s3",
      section: "soft",
      code: "S3",
      title: "Manter-se atualizado",
      prompt:
        "Como te mantens atualizado num setor que muda todos os meses? Últimas duas coisas concretas que aprendeste nas últimas 4 semanas.",
      criteria: [
        { id: "a", label: "1.ª coisa concreta e recente", pts: 2 },
        { id: "b", label: "2.ª coisa concreta e recente", pts: 2 },
        { id: "c", label: "Fontes concretas (Google Search Central, newsletters, especialistas)", pts: 2 },
        { id: "d", label: "Testa coisas por conta própria", pts: 2 },
        { id: "e", label: "Já aplicou o que aprendeu no trabalho", pts: 2 },
      ],
      penalties: [RF("Resposta vaga («leio uns blogs») ou não se lembra de nada.")],
    },
    {
      id: "s4",
      section: "soft",
      code: "S4",
      title: "Reportar sem subida de rankings",
      prompt:
        "Como reportarias resultados a um cliente não-técnico ao fim de 3 meses, sabendo que os rankings ainda não subiram significativamente?",
      criteria: [
        { id: "a", label: "Começa pelo que importa ao negócio (leads, chamadas, tráfego)", pts: 2 },
        { id: "b", label: "Mostra sinais de progresso (impressões, keywords a subir, trabalho feito)", pts: 2 },
        { id: "c", label: "Linguagem simples, sem jargão", pts: 2 },
        { id: "d", label: "Honesto: diz que ainda não subiram e explica porquê", pts: 2 },
        { id: "e", label: "Próximos passos e prazos claros", pts: 2 },
      ],
      penalties: [RF("Esconde dados, arranja desculpas ou enche o report de gráficos técnicos.")],
    },
    {
      id: "s5",
      section: "soft",
      code: "S5",
      title: "Prazo de resultados em GEO",
      prompt: "Se um cliente te perguntar «quanto tempo até vermos resultados em GEO?», como respondes?",
      criteria: [
        { id: "a", label: "Não dá garantias nem datas fixas", pts: 3 },
        { id: "b", label: "Explica do que depende (autoridade, concorrência, conteúdo)", pts: 2 },
        { id: "c", label: "Diz como vamos medir", pts: 3 },
        { id: "d", label: "Liga ao SEO: uma boa base acelera o GEO", pts: 2 },
      ],
      penalties: [RF("Promete prazos («em 1 mês estás no ChatGPT»).")],
    },
    {
      id: "s6",
      section: "soft",
      code: "S6",
      title: "«Quero estar em #1 para dentista»",
      prompt: "Um cliente diz: «quero estar em #1 para dentista». Qual é a tua resposta imediata?",
      criteria: [
        { id: "a", label: "Geografia: «dentista» é pesquisa local, onde?", pts: 2 },
        { id: "b", label: "Intenção: quem pesquisa e o que quer", pts: 2 },
        { id: "c", label: "Viabilidade: concorrência, Maps vs orgânico", pts: 2 },
        { id: "d", label: "ROI: propõe keywords que trazem pacientes (ex.: «implantes dentários Cascais»)", pts: 3 },
        { id: "e", label: "Faz o reframe com tato", pts: 1 },
      ],
      penalties: [RF("Aceita a premissa e promete o #1.")],
    },
    {
      id: "s7",
      section: "soft",
      code: "S7",
      title: "Explicar canibalização (role-play)",
      prompt: "Como explicas «canibalização» a um dono de clínica de 60 anos que não é técnico? Fá-lo agora, comigo.",
      criteria: [
        { id: "a", label: "Zero jargão", pts: 3 },
        { id: "b", label: "Usa uma analogia simples", pts: 3 },
        { id: "c", label: "Diz porque é mau para o negócio", pts: 2 },
        { id: "d", label: "Diz o que vamos fazer para resolver", pts: 1 },
        { id: "e", label: "Curto e confirma se o cliente percebeu", pts: 1 },
      ],
      penalties: [RF("Termos técnicos ou tom condescendente.")],
    },
    {
      id: "s8",
      section: "soft",
      code: "S8",
      title: "Iniciativa sem aprovação",
      prompt: "Conta-me sobre um projeto onde tomaste iniciativa sem esperar aprovação. O que fizeste e qual foi o resultado?",
      criteria: [
        { id: "a", label: "Exemplo real e concreto", pts: 2 },
        { id: "b", label: "Identificou o problema sozinho", pts: 2 },
        { id: "c", label: "Explica o que fez, passo a passo", pts: 2 },
        { id: "d", label: "Resultado com impacto", pts: 2 },
        { id: "e", label: "Bom julgamento: não pôs o cliente em risco", pts: 2 },
      ],
      penalties: [RF("Não tem exemplo, ou arriscou algo grave sem avisar ninguém.")],
    },
    // ── Atenção ao detalhe ──────────────────────────────────────────────
    {
      id: "d1",
      section: "detail",
      code: "D",
      title: "Atenção ao detalhe",
      prompt: "Doc com 10 erros plantados, encontrar na call, sem AI. 1 ponto por erro encontrado.",
      criteriaLabel: "Erro plantado",
      materials: ["teste-detalhe-candidato", "teste-detalhe-marcado", "teste-detalhe-solucoes"],
      // As pistas «onde está» vêm da folha de soluções (o mesmo n.º no PDF marcado).
      criteria: [
        { id: "a", label: "Title com mais de 60 caracteres", pts: 1, hint: "Secção 2 · /ortodontia: o title tem 86 caracteres" },
        { id: "b", label: "Meta description duplicada noutra página", pts: 1, hint: "Secção 2 · /branqueamento-dentario e /higiene-oral" },
        { id: "c", label: "Canonical a apontar para a página errada", pts: 1, hint: "Secção 2 · /branqueamento-dentario aponta para /ortodontia" },
        { id: "d", label: "Noindex numa página importante", pts: 1, hint: "Secção 2 · /implantes-dentarios: «noindex, follow»" },
        { id: "e", label: "Dois H1 na mesma página", pts: 1, hint: "Secção 2 · /equipa: «H1: Higiene oral» devia ser H2" },
        { id: "f", label: "Link partido (404)", pts: 1, hint: "Secção 3 · /contactos → /unidades/cascais dá 404" },
        { id: "g", label: "Telefone diferente entre unidades (NAP)", pts: 1, hint: "Secção 4 · Cascais: site 214 830 112, Google 214 830 121" },
        { id: "h", label: "Erro ortográfico", pts: 1, hint: "Secção 1, 2.º parágrafo: «concorência»" },
        { id: "i", label: "Data ou ano errado", pts: 1, hint: "Cabeçalho: «Data do rastreio: 31/11/2026» (novembro tem 30 dias)" },
        { id: "j", label: "Percentagem mal calculada", pts: 1, hint: "Secção 1, 1.º parágrafo: 1.200 → 1.500 é +25%, não +20%" },
      ],
      penalties: [RF("Usa AI ou diz «parece-me tudo bem».")],
    },
    // ── Perguntas do candidato ──────────────────────────────────────────
    {
      id: "q1",
      section: "questions",
      code: "P",
      title: "Perguntas do candidato (no fim)",
      // O guião não tem pergunta realçada aqui: é a vez do candidato.
      prompt: "",
      criteriaLabel: "O que pergunta",
      criteria: [
        { id: "a", label: "Clientes, stack ou processos → interessado no trabalho real", pts: 4 },
        { id: "b", label: "Autonomia, decisões, crescimento → alinhado com a cultura WonderAds", pts: 4 },
        { id: "c", label: "Perguntas preparadas e específicas sobre a WonderAds", pts: 2 },
        { id: "d", label: "Salário, férias, remote → legítimo, não conta para nada", pts: 0 },
      ],
      penalties: [
        { kind: "cap", id: "beneficios", label: "Só pergunta por benefícios sem tocar no trabalho → nota máx. 3", max: 3 },
        { kind: "cap", id: "sem-perguntas", label: "Sem perguntas → nota máx. 2", max: 2 },
      ],
    },
    // ── Pessoal (v80.17) ────────────────────────────────────────────────
    // As perguntas do André, tal e qual. Sem pontos: só notas, fora do Fit e
    // da Técnica.
    pessoal("pe1", "V1", "Depois do trabalho", "O que fazes depois do trabalho?"),
    pessoal("pe2", "V2", "Ginásio", "Vais ao ginásio?"),
    pessoal("pe3", "V3", "Relação", "Tens namorada/o? Há quanto tempo?", true),
    pessoal("pe4", "V4", "Religião", "Tens religião?", true),
    pessoal("pe5", "V5", "Com quem vive", "Vives sozinho/a, com amigos ou com a família?", true),
    pessoal("pe6", "V6", "Daqui a cinco anos", "Onde te vês daqui a cinco anos?"),
    pessoal("pe7", "V7", "Filhos", "Queres ter filhos um dia?", true),
  ],
  fit: {
    label: "Fit Cultural",
    signals: "frontalidade, honestidade com o cliente, aceita feedback, iniciativa, curiosidade",
    zones: { low: "Baixo", mid: "Médio", high: "Alto" },
  },
  tech: {
    label: "Capacidade Técnica",
    signals: "raciocínio de prioridades, exemplos com números, à-vontade a mostrar no ecrã, detalhe",
    zones: { low: "Baixa", mid: "Média", high: "Alta" },
  },
};


// ── Fase 1 · Parte 1 (v80.22) ─────────────────────────────────────────────
// Reunião curta de apresentação, para perceber se vale a pena seguir para a
// Fase 2. As 9 perguntas são as do André (23/11/2026), tal e qual. Sem
// pontos: só notas, e as respostas de salário, zona, percurso e hobbies
// ficam logo no perfil do candidato.
const triagem = (
  id: string,
  code: string,
  section: SectionId,
  title: string,
  prompt: string,
  profile?: ProfileLink,
): Question => ({
  id,
  section,
  code,
  title,
  prompt,
  criteria: [],
  penalties: [],
  unscored: true,
  ...(profile ? { profile } : {}),
});

const SEO_FASE1_P1: InterviewTemplate = {
  id: "seo-fase1-p1",
  version: 1,
  kind: "screening",
  title: "Reunião de apresentação",
  role: "Consultor de SEO",
  phase: "Fase 1 · Parte 1",
  opening: ["Reunião curta de apresentação: conhecer o candidato e perceber se vale a pena seguir para a Fase 2."],
  scoringNote: "Sem pontos: só notas. No fim decides se avança para a Fase 2.",
  sections: [
    { id: "condicoes", label: "Condições", short: "Condições" },
    { id: "percurso", label: "Percurso", short: "Percurso" },
    { id: "pessoal", label: "Pessoal", short: "Pessoal" },
  ],
  questions: [
    triagem("f1", "1", "condicoes", "Objetivo salarial", "Qual é o teu objetivo salarial (uma baliza)?", "salary"),
    triagem("f2", "2", "condicoes", "Zona", "Estás onde (zona mesmo)?", "location"),
    triagem(
      "f3",
      "3",
      "condicoes",
      "Formato de contrato",
      "Queres que formato de contrato (precisas de já efetivo? termo certo? incerto?)",
    ),
    triagem("f4", "4", "percurso", "O que faz atualmente", "O que fazes atualmente?", "experience"),
    triagem("f5", "5", "percurso", "O que fazia antes", "O que fazias antes?", "experience"),
    triagem(
      "f6",
      "6",
      "percurso",
      "SEO, Web e marketing",
      "Já estudaste/interagiste com SEO/Web ou até marketing em geral?",
      "education",
    ),
    triagem("f7", "7", "percurso", "Trabalho remoto", "Já trabalhaste remotamente?"),
    triagem(
      "f8",
      "8",
      "percurso",
      "Liderar projetos e clientes",
      "Já alguma vez lideraste um projeto ou clientes contínuos de 6/12 meses?",
    ),
    triagem("f9", "9", "pessoal", "Hobbies", "Quais são os teus hobbies?", "interests"),
  ],
};

/** Pela ordem do processo: é a ordem das listas («Nova fase», novo
 *  candidato). */
export const INTERVIEW_TEMPLATES: InterviewTemplate[] = [SEO_FASE1_P1, SEO_FASE2_P1];

export function getTemplate(id: string): InterviewTemplate | null {
  return INTERVIEW_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** O template das entrevistas antigas sem `templateId` — fica a Fase 2. */
export const DEFAULT_TEMPLATE_ID = SEO_FASE2_P1.id;

/** Um candidato novo começa pela Fase 1 (v80.22). */
export const FIRST_TEMPLATE_ID = SEO_FASE1_P1.id;

export function isScreening(t: InterviewTemplate | null | undefined): boolean {
  return t?.kind === "screening";
}

/** Quantos ecrãs de fecho tem a entrevista: a triagem só tem a decisão;
 *  as outras têm fortes/fracos, Fit e Técnica e a grade. */
export function closingScreens(t: InterviewTemplate): number {
  return isScreening(t) ? 1 : 3;
}
