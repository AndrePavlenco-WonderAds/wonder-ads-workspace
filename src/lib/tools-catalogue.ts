// Catálogo das ferramentas da agência — a lista que a página /tools mostra.
//
// PURO (sem KV, sem React): serve o componente de cliente e o servidor.
//
// DUAS CAMADAS (v77.30). As ferramentas de base vivem aqui em código, com
// logótipos em /public. Por cima, o KV (tools-catalogue-store.ts) guarda o
// que os SuperAdmins mudam na própria página: as apps que acrescentaram e
// os ids das de base que removeram. Nunca se grava a lista inteira em KV —
// assim uma ferramenta nova acrescentada aqui continua a aparecer a toda a
// gente sem migração, e um `kv.del` só desfaz as mudanças feitas na app.

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
  /** Ficheiro em /public/tool-logos (base) ou URL do Vercel Blob (apps
   *  acrescentadas na página). null → o cartão mostra a inicial do nome
   *  sobre a cor da marca.
   *
   *  NÃO em /public/tools: aí o URL do ficheiro (`/tools/ga4.svg`) cairia
   *  dentro do matcher do middleware da própria página, e um logótipo
   *  passaria pelo portão de sessão como se fosse uma rota. */
  logo: string | null;
  logoFit: ToolLogoFit;
  /** Cor da marca, usada no halo e no rebordo do cartão em hover. */
  accent: string;
  /** Outros nomes por que a ferramenta é procurada («Google Analytics»
   *  para o GA4, «Business Profile» para o GMB). */
  aliases: string[];
  /** true → acrescentada por um SuperAdmin na página (vive em KV). */
  custom?: boolean;
};

export const BUILTIN_WORKSPACE_TOOLS: WorkspaceTool[] = [
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
    id: "ahrefs",
    name: "Ahrefs",
    category: "SEO",
    description:
      "SEO de referência para backlinks, keywords, auditorias ao site e análise da concorrência.",
    url: "https://app.ahrefs.com/",
    logo: "/tool-logos/ahrefs.png",
    logoFit: "cover",
    // O laranja da marca (o do mask-icon), não o azul do fundo do ícone.
    accent: "#FF8D00",
    aliases: ["A hrefs", "Site Explorer", "Backlinks", "Keywords Explorer"],
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

/** Ids que nunca podem ser de uma app: `catalogue` é um segmento estático
 *  em /api/tools/, e uma ferramenta com esse id deixava de ser editável. */
const RESERVED_IDS = new Set(["catalogue"]);

/** Id legível e único a partir do nome: «Envato Elements Pro» →
 *  `envato-elements-pro`; se já existir (ou for de uma app de base
 *  removida), ganha `-2`, `-3`… */
export function makeToolId(name: string, taken: Iterable<string>): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "app";
  const used = new Set(taken);
  for (const r of RESERVED_IDS) used.add(r);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export const DEFAULT_TOOL_ACCENT = "#783DF5";

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
}

/** Os campos de texto de uma app nova, higienizados e com tetos de tamanho.
 *  Devolve o erro a mostrar quando falta o essencial. O URL valida-se na
 *  rota (isHttpUrl vive no store das credenciais). */
export function sanitiseNewToolFields(raw: {
  name?: unknown;
  category?: unknown;
  description?: unknown;
  url?: unknown;
  accent?: unknown;
  logoFit?: unknown;
  aliases?: unknown;
}):
  | {
      ok: true;
      fields: Omit<WorkspaceTool, "id" | "logo" | "custom">;
    }
  | { ok: false; error: string } {
  const trim = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const name = trim(raw.name, 60);
  const url = trim(raw.url, 600);
  if (!name) return { ok: false, error: "A app precisa de um nome." };
  if (!url) return { ok: false, error: "A app precisa de um link." };
  const aliases = trim(raw.aliases, 400)
    .split(",")
    .map((a) => a.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 12);
  return {
    ok: true,
    fields: {
      name,
      category: trim(raw.category, 30) || "Outros",
      description: trim(raw.description, 160),
      url,
      accent: isHexColor(raw.accent) ? raw.accent : DEFAULT_TOOL_ACCENT,
      logoFit: raw.logoFit === "contain" ? "contain" : "cover",
      aliases,
    },
  };
}
