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
  "a-domingos": EMPTY,
  "senior-resort": EMPTY,
  "clinica-mimus": EMPTY,
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

  // ADS-only clients
  "clinica-empatia": EMPTY,

  // Web-only clients
  "prof-fernando-almeida": EMPTY,
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
