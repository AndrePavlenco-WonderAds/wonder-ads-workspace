// Per-client brief — Do's, Don'ts, and General notes.
// Keyed by client slug (same slugs as Notion/colors/tiers).
//
// Edit this file directly to update a brief, then push. Briefs are read on
// /seo/[slug] pages and will also feed the per-project Claude blog-writer
// chat (v18) and the ADS DPT once cross-department views land.

export type ClientBrief = {
  dos: string[];
  donts: string[];
  notes: string[];
};

const EMPTY: ClientBrief = { dos: [], donts: [], notes: [] };

const BRIEFS: Record<string, ClientBrief> = {
  "insync-design": EMPTY,
  ihn: EMPTY,
  "aeger-prima": EMPTY,
  "b-life": EMPTY,
  "a-domingos": EMPTY,  "clinica-mimus": EMPTY,
  wonderads: EMPTY,
  "monte-mar": EMPTY,
  cdt: EMPTY,
  "sea-yourself": EMPTY,
  "hds-learning": EMPTY,
  "white-clinic": EMPTY,
  "fisio-restelo": EMPTY,
  "safe-away": EMPTY,
  "clinica-em-casa": EMPTY,
  "spine-center": EMPTY,
  cuidamais: EMPTY,

  // André Pereira's clients (v74.31). Do's/Don'ts/Notes generated from
  // their onboarding forms (2025/2026) — draft for André to review/refine.
  "sentir-saude": {
    dos: [
      "Priorizar as keywords MBST + Premium Recovery (MBST Portugal, Tratamento MBST, Terapia MBST, Reabilitação Intensiva, Premium Recovery) — é o foco estratégico e o maior diferenciador da clínica.",
      "Construir conteúdo para os 3 pilares clínicos: tratamentos sem cirurgia (artrose, hérnia discal, osteoporose), Fisioterapia Pélvica (Porto, gravidez, pós-parto) e Osteopatia/Fisioterapia Pediátrica (plagiocefalia, torcicolo, bebés).",
      "Trabalhar SEO nacional E internacional — criar conteúdo/páginas EN para Premium Recovery e MBST a captar pacientes do Reino Unido, Irlanda, Suíça, Luxemburgo, Alemanha, França, Bélgica, Países Baixos e EUA.",
      "Geo-targeting Grande Porto: Vila do Conde, Póvoa de Varzim, Matosinhos, Maia, Porto e Braga (distritos do Porto, Braga e Viana do Castelo).",
      "Criar FAQ/conteúdo que responda às objeções listadas no onboarding (será que ajuda, quantas sessões, evidência da MBST, é seguro para bebés, vale a pena viajar do estrangeiro, etc.) — forte sinal E-E-A-T.",
      "Reforçar reviews Google e a presença em motores de IA (ChatGPT/GEO) — objetivo explícito do cliente.",
      "Envolver Paulo Fernandes (contacto principal) como revisor/autor do conteúdo clínico.",
    ],
    donts: [
      "NUNCA usar: «cura garantida», «resultados garantidos», «milagroso», «cura definitiva», «melhor do mundo» nem linguagem sensacionalista.",
      "Não fazer comparações depreciativas com concorrentes.",
      "Não limitar a estratégia ao local — a clínica quer também posicionamento nacional e internacional.",
      "Não prometer resultados clínicos garantidos (a clínica não dá garantias formais).",
    ],
    notes: [
      "Sentir Saúde — clínica médica e de reabilitação (Fisioterapia Avançada e Osteopatia). Morada: Avenida de Portas Fronhas, n.º 300 R/c. Contacto: Paulo Fernandes — 919049837 / geral@sentirsaude.pt. Aniversário da empresa em Junho.",
      "Tom de voz: profissional, especializado e credível, mas simultaneamente próximo, humano e acessível.",
      "Ferramentas confirmadas: Google Analytics, Search Console e Google My Business (sem Merchant Center / Tag Manager).",
      "Serviços mais vendidos: Fisioterapia avançada, Fisioterapia pélvica, Fisioterapia/Osteopatia pediátrica, MBST e Pilates clínico. Tecnologia: MBST, Laser de Alta Potência, Ondas de Choque Focais, SIS, Pilates Clínico.",
      "Concorrentes a analisar: fisioglobal.pt, tiagopinhao.pt, clinicaluisbaos.es, fisiovida.pt, utopiaclinique.com, clinicacapon.com, vitalyscenter.es.",
      "Sem migração de site prevista. Sem ofertas/garantias/credenciais formais ainda. LTV 150€–2000€, CAC ~100€, ticket médio ~50€. Clientes vêm de referências + orgânico (redes sociais).",
      "Frase âncora da marca: «Na Sentir Saúde combinamos conhecimento clínico especializado, tecnologia avançada e acompanhamento humano para ajudar cada pessoa a recuperar a sua qualidade de vida, mesmo nos casos mais complexos.»",
    ],
  },
  "clinica-fernando-almeida": {
    dos: [
      "Estruturar keywords por serviço + área: «tratamento + área», «implantes + área», «alinhadores + área», «facetas + área». Áreas: Carvalhos, Pedroso, Vila Nova de Gaia, Espinho e Belém/Lisboa.",
      "Criar/otimizar páginas locais para as duas localizações — Gaia (Pedroso/Carvalhos) e Lisboa (Belém) — com geo-targeting de raio 20-30km de cada clínica.",
      "Foco nos serviços âncora: tratamentos generalistas (limpezas), implantes e alinhadores/aparelhos.",
      "Forte aposta em Google Business Profile + estratégia de reviews — é o objetivo nº1 do cliente (aumentar e melhorar as reviews Google); de momento só têm GMB ativo.",
      "Configurar e ligar Google Analytics + Search Console (inexistentes) ANTES de medir resultados.",
      "Destacar diferenciadores nas páginas: maior clínica do Norte (15 gabinetes só de medicina dentária), tecnologia (scans/diagnóstico), facilidades de pagamento/crédito sem juros e 15 anos de experiência.",
      "Criar FAQ/conteúdo a responder às objeções: dor, duração do tratamento e custos extra.",
    ],
    donts: [
      "NÃO usar as palavras «empréstimo» nem «barato» no conteúdo.",
      "Não assumir GA/GSC configurados — confirmar o setup primeiro.",
      "Aguardar envio da Rita antes de publicar: frase única da marca, credenciais/testemunhos e LTV/CAC/ticket médio (não inventar).",
    ],
    notes: [
      "Clínicas Dentárias Prof. Dr. Fernando Almeida. Contacto: Rita Valente — carvalhos@clinicasdentariasfa.pt / 227 845 903 / 919 877 988. Tom: amigável e profissional (warm professional).",
      "Moradas: Rua Gonçalves de Castro, 118, 4415-376 Pedroso (Gaia); R. Luís Braille A3, 1400-031 Lisboa. Website: clinicasdentariasfa.pt/pt.",
      "⚠️ Migração do site para WordPress planeada para as próximas semanas — coordenar SEO técnico (redirects, preservação de URLs) com a equipa Web.",
      "Ferramentas: apenas Google My Business ativo (sem GA / GSC / Merchant Center / Tag Manager).",
      "Público-alvo: 30-70 anos + pais de crianças. Clientes vêm sobretudo de referências/boca-a-boca.",
      "Concorrentes Gaia: Clínica Central dos Carvalhos, DentalGN, Smile Up, Trofa Saúde, Clínica da Avenida, Clínica Dentária de Gaia (Lisboa: a indicar).",
      "Marketing anterior: tentaram internamente — muito investimento e pouco retorno. Valorizam transparência, comunicação e resultados; detestam perdas de tempo. Ofertas: parcerias/acordos com associações + facilidades de pagamento (intermediação de crédito). Branding: 4 cores do logo (guia por enviar).",
    ],
  },

  // Medway (v77.37) — notas da análise técnica ao CMS (site PHP à medida).
  medway: {
    dos: [
      "Separar o plano de implementação em três frentes: (1) alterações na base de dados, (2) alterações nos templates PHP e (3) funcionalidades novas no CMS — cada uma com esforço e dono diferentes.",
      "Alt text nas imagens em HTML guardado na BD (ex. blog_lang.text): gerar SQL seguro e transacional, com parser de HTML, que altera só o atributo alt da tag <img>.",
      "BreadcrumbList e LocalBusiness: implementar no template PHP (global, ou por rota/slug nas páginas de clínicas) em vez de página a página.",
      "Páginas comerciais (homepage, sobre nós, tratamentos): confirmar primeiro se o conteúdo vem da BD ou está hardcoded no PHP antes de estimar.",
    ],
    donts: [
      "Não prometer ao cliente que tudo se faz pelo painel — parte do trabalho exige mexer na BD e/ou nos templates PHP.",
      "Não vender blocos de conteúdo novos nem FAQs como «editáveis pelo cliente» enquanto o CMS não tiver essa funcionalidade — é desenvolvimento.",
      "Não tomar a cobertura de um campo (100% vs 0%) como prova de que uma página foi feita à mão: percentagens irregulares também vêm de templates antigos, campos opcionais, várias tabelas, conteúdos migrados ou HTML colado em campos do CMS.",
    ],
    notes: [
      "CMS: muito conteúdo vive em tabelas — blog_lang.text, blog_lang_*, menu_lang, menu_block_lang, menu_footer_lang, cms_option, etc. Muitas alterações fazem-se na BD ou no código, mesmo sem campos próprios no backend.",
      "Resumo: conseguimos implementar uma parte significativa, mas não tudo só pelo painel.",
      "Alt text — artigos/blog: SIM na maioria dos casos (HTML na BD). Páginas comerciais: provavelmente sim — BD se estiver lá, PHP/template se estiver hardcoded.",
      "Dados estruturados — BreadcrumbList: SIM, via template PHP global. LocalBusiness nas clínicas: SIM, via template das clínicas ou lógica por rota/slug.",
      "FAQs novas/editáveis: tecnicamente SIM — BD se já houver tabelas/estrutura, senão código/template.",
      "Blocos de conteúdo novos: DEPENDE — se o CMS não suporta blocos, é desenvolvimento PHP/CMS. Páginas novas: DEPENDE — sim se já houver tabela/rota no CMS, senão código.",
      "Páginas «fechadas» no código não se resolvem com formação no painel; com acesso ao código/backup alteram-se os templates ou criam-se campos novos.",
    ],
  },

  // ADS-only clients
  "clinica-empatia": EMPTY,
};

export function getClientBrief(slug: string): ClientBrief {
  return BRIEFS[slug] ?? EMPTY;
}

export function hasAnyBriefContent(brief: ClientBrief): boolean {
  return (
    brief.dos.length > 0 ||
    brief.donts.length > 0 ||
    brief.notes.length > 0
  );
}
