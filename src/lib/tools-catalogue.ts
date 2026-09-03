// Catálogo das ferramentas da agência — a lista que a página /tools mostra.
//
// PURO (sem KV, sem React): serve o componente de cliente e o servidor.
//
// PORQUE VIVE EM CÓDIGO E NÃO EM KV. A lista de ferramentas muda quando a
// agência assina ou cancela uma subscrição — um evento de deploy, não de
// utilizador. Só as CREDENCIAIS vivem em KV (tools-access-store.ts), o que
// significa que acrescentar uma ferramenta aqui a faz aparecer a toda a
// gente sem migração nenhuma, e que um `kv.del` nunca apaga o catálogo.

/** Ícones que já trazem fundo próprio (Figma, Loom, Claude…) preenchem o
 *  azulejo como um ícone de app; os transparentes (GA4, GTM, GSC, GMB)
 *  respiram com margem por dentro. */
export type ToolLogoFit = "cover" | "contain";

export type WorkspaceTool = {
  id: string;
  name: string;
  /** Pastilha do cartão. Também entra na pesquisa. */
  category: string;
  /** 10–15 palavras: o que a ferramenta faz, sem marketing. */
  description: string;
  /** Onde se entra — o logótipo e o nome abrem este endereço. */
  url: string;
  /** Ficheiro em /public/tool-logos.
   *
   *  NÃO em /public/tools: aí o URL do ficheiro (`/tools/ga4.svg`) cairia
   *  dentro do matcher do middleware da própria página, e um logótipo
   *  passaria pelo portão de sessão como se fosse uma rota. */
  logo: string;
  logoFit: ToolLogoFit;
  /** Cor da marca, usada no halo e no rebordo do cartão em hover. */
  accent: string;
  /** Outros nomes por que a ferramenta é procurada («Google Analytics»
   *  para o GA4, «Business Profile» para o GMB). */
  aliases: string[];
};

export const WORKSPACE_TOOLS: WorkspaceTool[] = [
  {
    id: "ga4",
    name: "GA4",
    category: "Analytics",
    description:
      "Analítica do site: sessões, origens de tráfego, eventos e conversões em tempo real.",
    url: "https://analytics.google.com/",
    logo: "/tool-logos/ga4.svg",
    logoFit: "contain",
    accent: "#E37400",
    aliases: ["Google Analytics", "Analytics 4", "Universal Analytics"],
  },
  {
    id: "gsc",
    name: "GSC",
    category: "SEO",
    description:
      "Desempenho na Pesquisa Google: impressões, cliques, posições, indexação e erros técnicos.",
    url: "https://search.google.com/search-console",
    logo: "/tool-logos/gsc.png",
    logoFit: "contain",
    accent: "#4285F4",
    aliases: ["Search Console", "Google Search Console", "Webmaster Tools"],
  },
  {
    id: "gmb",
    name: "GMB",
    category: "Local SEO",
    description:
      "Fichas de negócio na Google: Maps, avaliações, publicações, horários e fotografias.",
    url: "https://business.google.com/",
    logo: "/tool-logos/gmb.png",
    logoFit: "contain",
    accent: "#5083F5",
    aliases: [
      "Google My Business",
      "Business Profile",
      "Perfil de Empresa",
      "Google Maps",
    ],
  },
  {
    id: "gtm",
    name: "GTM",
    category: "Medição",
    description:
      "Gestão de tags, píxeis e eventos de medição sem tocar no código.",
    url: "https://tagmanager.google.com/",
    logo: "/tool-logos/gtm.svg",
    logoFit: "contain",
    accent: "#4285F4",
    aliases: ["Google Tag Manager", "Tag Manager", "Tags", "Pixel"],
  },
  {
    id: "claude",
    name: "Claude Max",
    category: "IA",
    description:
      "IA da Anthropic para escrita longa, análise de documentos e trabalho técnico.",
    url: "https://claude.ai/",
    logo: "/tool-logos/claude.png",
    logoFit: "cover",
    accent: "#D97757",
    aliases: ["Anthropic", "Claude AI", "Opus", "Sonnet"],
  },
  {
    id: "chatgpt",
    name: "ChatGPT Pro",
    category: "IA",
    description:
      "Assistente de IA da OpenAI para pesquisa, redação, análise e automatização de tarefas.",
    url: "https://chatgpt.com/",
    logo: "/tool-logos/chatgpt.png",
    logoFit: "cover",
    accent: "#10A37F",
    aliases: ["OpenAI", "GPT", "Chat GPT"],
  },
  {
    id: "semrush",
    name: "SemRush",
    category: "SEO",
    description:
      "Suite de SEO: keywords, backlinks, auditorias técnicas e análise da concorrência.",
    url: "https://www.semrush.com/",
    logo: "/tool-logos/semrush.png",
    logoFit: "cover",
    accent: "#B08CFF",
    aliases: ["Semrush", "SEM Rush", "Keyword Magic", "Position Tracking"],
  },
  {
    id: "envato-elements",
    name: "Envato Elements Pro",
    category: "Criativo",
    description:
      "Biblioteca ilimitada de templates, vídeos, fotografias, mockups e fontes para criativos.",
    url: "https://elements.envato.com/",
    logo: "/tool-logos/envato-elements.png",
    logoFit: "cover",
    accent: "#82D542",
    aliases: ["Envato", "Elements", "Templates", "Mockups", "Stock"],
  },
  {
    id: "loom",
    name: "Loom Pro",
    category: "Vídeo",
    description:
      "Gravação de ecrã e vídeos rápidos para explicar trabalho a clientes.",
    url: "https://www.loom.com/",
    logo: "/tool-logos/loom.png",
    logoFit: "cover",
    // O azul do ícone, não o índigo da marca — o André queria o halo azul.
    accent: "#2F6BFF",
    aliases: ["Screen recording", "Gravação de ecrã", "Vídeo"],
  },
  {
    id: "figma",
    name: "Figma Pro",
    category: "Design",
    description:
      "Design de interfaces e protótipos, com colaboração da equipa em tempo real.",
    url: "https://www.figma.com/",
    logo: "/tool-logos/figma.png",
    logoFit: "cover",
    accent: "#F24E1E",
    aliases: ["UI", "Protótipos", "Mockups", "Design"],
  },
  {
    id: "serpstat",
    name: "Serpstat",
    category: "SEO",
    description:
      "Plataforma SEO: pesquisa de keywords, volumes, análise de domínios e backlinks.",
    url: "https://serpstat.com/",
    logo: "/tool-logos/serpstat.png",
    logoFit: "cover",
    accent: "#0F5EA8",
    aliases: ["Serp stat", "Keywords", "Volume de pesquisa"],
  },
  {
    id: "searchable",
    name: "Searchable",
    category: "GEO",
    description:
      "Visibilidade da marca nas respostas de IA: ChatGPT, Claude, Perplexity e Google AI.",
    url: "https://www.searchable.com/",
    logo: "/tool-logos/searchable.png",
    logoFit: "cover",
    // O ícone é preto e branco; o halo branco parecia um cartão apagado.
    // Laranja como o GA4, a pedido do André.
    accent: "#E37400",
    aliases: [
      "Searchable.com",
      "AI visibility",
      "Visibilidade IA",
      "LLM",
      "AI Overviews",
      "Perplexity",
    ],
  },
];

export const TOOL_IDS: string[] = WORKSPACE_TOOLS.map((t) => t.id);

export function getWorkspaceTool(id: string): WorkspaceTool | null {
  return WORKSPACE_TOOLS.find((t) => t.id === id) ?? null;
}
