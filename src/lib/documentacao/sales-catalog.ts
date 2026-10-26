// O que vender em cada renovação — serviços, provas e meios. Texto do guia
// «Renovações — Programa de Crescimento Orgânico» (outubro 2026), arrumado
// por serviço: cada um leva os seus casos de referência ao lado, para o
// consultor ter tudo no mesmo sítio durante a conversa.

export type CrossSell = {
  id: string;
  name: string;
  /** Investimento mínimo, como se diz ao cliente. */
  minimum: string;
  minimumNote?: string;
  freeAudit: boolean;
  points: string[];
  /** Clientes onde já fizemos este serviço. */
  references: string[];
};

export const CROSS_SELLS: CrossSell[] = [
  {
    id: "google-ads",
    name: "Google Ads",
    minimum: "2.000 €/mês",
    minimumNote: "1.000 € de fee + 1.000 € de ad spend mínimo",
    freeAudit: true,
    points: [
      "Serviço mais técnico e um dos nossos pontos fortes.",
      "O Diretor de Anúncios tem 10 anos de carreira e mais de 10 M€ geridos em ad spend.",
      "Especialidade em lead generation. Também fazemos eCommerce.",
      "Temos contactos dentro da rede Google.",
    ],
    references: ["White Clinic", "António Gaspar", "PhysioHub", "MyDermaCare", "IHN", "IFA"],
  },
  {
    id: "meta-ads",
    name: "Meta Ads",
    minimum: "2.000 €/mês",
    minimumNote: "1.000 € de fee + 1.000 € de ad spend mínimo",
    freeAudit: true,
    points: [
      "Não fazemos captação de imagem nem vídeo.",
      "Precisa de um parceiro, externo ou interno, para X criativos por mês, consoante o investimento.",
    ],
    references: ["White Clinic", "IHN", "IFA", "InSync Design", "Wellnest Nutrition"],
  },
  {
    id: "crm",
    name: "CRM",
    minimum: "Orçamento personalizado",
    freeAudit: true,
    points: [
      "Instalação de raiz ou melhoria do sistema que o cliente já tem.",
      "Auditoria gratuita do sistema atual, sempre antes de orçamentar.",
      "Programa de 3 meses.",
      "Caso forte: na White Clinic ligámos o Newsoft ao CRM e todas as leads passaram a estar num só sistema. Usa-o quando o cliente não sabe de onde vêm as leads nem o que lhes acontece.",
    ],
    references: ["White Clinic", "IFA", "IHN", "Abbey Dental Supplies"],
  },
  {
    id: "websites",
    name: "Websites e apps / plataformas",
    minimum: "Orçamento personalizado",
    freeAudit: false,
    points: [
      "Fazemos vários websites, incluindo com custom code.",
      "Apps e plataformas fazemos menos, mas temos parceiros que as desenvolvem.",
    ],
    references: [],
  },
];

export const WEBSITES: Array<{ name: string; url: string; about: string }> = [
  { name: "Paulo Malo Dental", url: "https://paulomalo.pt/", about: "Malo Dental, mais de 16 clínicas" },
  { name: "Bambuse Clinic", url: "https://bambuse.pt/", about: "Clínica de estética" },
  { name: "Quantum Global Care", url: "https://quantum.pt/", about: "Clínica de wellness e longevidade" },
  { name: "FaceMi", url: "https://face-mi.com", about: "Medicina estética: de 50 para mais de 470 reviews no Google" },
  { name: "FisioRestelo", url: "https://fisiorestelo.pt/", about: "Fisioterapia: de 20 para 220 reviews no Google" },
  { name: "SportsGuard", url: "https://sportsguard.com/", about: "Proteção dental desportiva" },
  { name: "Abbey Dental Supplies", url: "https://www.abbeydentalsupplies.com/", about: "Distribuidor dentário no Reino Unido" },
  { name: "Institute of Holistic Nutrition", url: "https://instituteofholisticnutrition.com/", about: "Universidade no Canadá: mais de 200 leads/mês só com SEO" },
  { name: "Kings Gyms", url: "https://kingsgyms.com/", about: "Cadeia de ginásios + eCommerce" },
  { name: "JHOMEA Invest", url: "https://jhomea.com/", about: "Agência imobiliária" },
  { name: "Blooming Skin", url: "https://bloomingskin.pt/", about: "Estética com 5 localizações; vende skincare online e em loja" },
];

export const PROOF_LINKS = {
  testimonials: "https://wonder-ads.com/testimonials/",
  playlist: "https://www.youtube.com/watch?v=-tJJ04qq6gA&list=PLmEMvmywC1OuVnDAKuqd6e03NxV_iL90q",
};

export const ADS_DIRECTOR = { name: "Hugo", email: "hugo@wonder-ads.com" };

export const TV: Array<{ channel: string; shows: string }> = [
  { channel: "RTP", shows: "Praça da Alegria, A Nossa Tarde, Portugal em Rede, Jornais Informativos" },
  { channel: "RTP 2", shows: "Sociedade Civil" },
  { channel: "RTP Notícias", shows: "Jornais Informativos" },
  { channel: "RTP Madeira / RTP Açores", shows: "Madeira Viva, Olhar Clínico" },
  { channel: "SIC", shows: "Casa Feliz, Júlia, Alô Portugal, Jornais Informativos" },
  { channel: "SIC Notícias", shows: "Jornais Informativos" },
  { channel: "SIC Mulher", shows: "Médico da Casa, What's Up TV, Chica Esperta" },
  { channel: "SIC Radical", shows: "Curto Circuito" },
  { channel: "TVI", shows: "Diário da Manhã, Dois às 10, Em Família, Jornais Informativos" },
  { channel: "CNN Portugal", shows: "Jornais Informativos" },
  { channel: "V+", shows: "Bom Dia Alegria, Para Si" },
  { channel: "CMTV", shows: "Olá, Bom Dia, Jornais Informativos" },
  { channel: "NOW", shows: "Jornais Informativos" },
  { channel: "Porto Canal", shows: "Consultório, Por Perto, Filhos & Cadilhos" },
  { channel: "Record TV", shows: "Fala Portugal" },
  { channel: "Conta Lá", shows: "Intercidades, Jornais Informativos" },
];

export const MEDIA: Array<{ label: string; items: string[] }> = [
  {
    label: "Jornais e revistas",
    items: [
      "Correio da Manhã", "Jornal de Notícias / Notícias Magazine", "Diário de Notícias", "Público", "Expresso",
      "Observador", "Sábado / Domingo", "Vogue / Esquire Portugal", "Visão / Visão Saúde",
      "Men's Health / Women's Health", "Saúde e Bem Estar", "Lux Woman", "Saber Viver",
      "Revista Mariana / TOP Novelas / TV Já", "Jornal Nascer do Sol / Revista i", "VIP", "Máxima / Must",
      "Business Portugal", "Exklusiva", "Forbes", "Luso Jornal",
    ],
  },
  { label: "Rádios", items: ["Renascença", "Comercial", "Observador", "M80", "Mega Hits", "Rádio CMR (Correio da Manhã)", "Outras rádios regionais"] },
  {
    label: "Podcasts e videocasts",
    items: ["«Diz-me Lá»", "«Conversas Saudáveis»", "«Consulta Aberta»", "«Inteligência Emocional»", "«Somos Todos Malucos»", "Outros, de empresas e particulares"],
  },
  {
    label: "Sites",
    items: [
      "NIT", "MAGG", "Versa", "Notícias ao Minuto", "Atlas da Saúde", "Sapo Lifestyle", "Saúde Online", "CNN Portugal",
      "SIC Notícias", "Conta Lá", "Viral", "HealthNews", "Líder Magazine", "Hall Magazine", "Motivo", "Blog Eu Sou Gira",
      "Alguns sites internacionais",
    ],
  },
  {
    label: "Eventos",
    items: ["Selfcare Market & Summit", "Foyer Health & Beauty Summit", "Eventos, palestras, workshops e congressos", "Outros eventos de saúde, editoriais e comerciais"],
  },
];
