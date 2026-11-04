// Origem de Pacientes (v78.68) — o add-on onde a receção de um cliente regista
// como cada pessoa nova o conheceu. É a versão digital do «registo de leads»
// do mês 2 da Jornada de Cliente: em vez de um Excel que o cliente envia no
// fim do mês, a receção toca numa origem e os números ficam na ficha.
//
// Como o Reviews Hub, é um produto por cliente: só os slugs desta tabela têm
// página (/<slug>/origem), chip no cabeçalho do SEO e API. Piloto: MyMedic.
//
// Módulo puro, sem segredos — vai também para o browser. O PIN de cada
// cliente vive só em access.ts (salt + hash).
//
// REGRA: os `id` de clínicas, origens e canais são a chave guardada em cada
// registo. Depois de haver dados, nunca se mudam — muda-se só o `label`. Uma
// origem retirada sai da lista `sources` mas os registos antigos continuam a
// contar como «Outra».

export type OrigemSite = {
  id: string;
  /** «Clínica de Viseu». */
  name: string;
  /** Nome curto para pastilhas e tabelas («Viseu»). */
  short: string;
  /** A morada, uma linha por elemento — o ecrã de escolha da clínica mostra-a
   *  para a receção reconhecer a sua. */
  address?: string[];
};

export type OrigemSource = {
  id: string;
  label: string;
  /** Uma linha por baixo do rótulo, para a receção não hesitar. */
  hint: string;
  /** Cor da origem nos gráficos e no botão selecionado. */
  color: string;
  /** Conta para «Pesquisa e IA» — o que o SEO/GEO trabalha. */
  search?: true;
};

export type OrigemChannel = {
  id: string;
  label: string;
  /** Como se lê numa frase: «Google, por telefone». */
  phrase: string;
};

export type OrigemClient = {
  slug: string;
  brand: string;
  /** Palavras da página: «paciente(s)» numa clínica, «cliente(s)» num salão. */
  person: { one: string; many: string };
  place: {
    one: string;
    many: string;
    /** «a clínica» / «o salão». */
    the: string;
    /** «nesta clínica» / «neste salão». */
    inThis: string;
  };
  sites: OrigemSite[];
  sources: OrigemSource[];
  channels: OrigemChannel[];
  /** Primeiro dia com registos (AAAA-MM-DD) — os meses começam aqui. */
  startDay: string;
  /** As cores da marca do cliente — a página inteira veste-as. */
  theme: OrigemTheme;
};

export type OrigemTheme = {
  /** Fundo da página. */
  paper: string;
  /** Texto principal e botões escuros. */
  ink: string;
  /** Texto secundário. */
  muted: string;
  /** Linhas e contornos. */
  line: string;
  /** A cor da marca (destaques, seleção). */
  primary: string;
  /** A cor da marca em versão escura, legível como texto. */
  deep: string;
  /** O acento da marca. */
  accent: string;
  /** A marca gráfica do cliente no ecrã (a cruz da MyMedic). */
  mark: "mymedic-cross" | "dot";
};

const MYMEDIC: OrigemClient = {
  slug: "mymedic",
  brand: "MyMedic Clínicas",
  person: { one: "paciente", many: "pacientes" },
  place: { one: "clínica", many: "clínicas", the: "a clínica", inThis: "nesta clínica" },
  // As duas clínicas de mymedic.pt/contactos (03/11/2026). Confirmar com o
  // cliente antes de ligar o tablet.
  sites: [
    { id: "viseu", name: "Clínica de Viseu", short: "Viseu", address: ["Rua João Mendes, 143", "3500-142 Viseu"] },
    {
      id: "fornos",
      name: "Clínica de Fornos de Algodres",
      short: "Fornos de Algodres",
      address: ["Estrada Nacional 16, n.º 131", "6370-148 Fornos de Algodres"],
    },
  ],
  // As cores vêm das duas marcas (o teal e o lima da MyMedic, o violeta e o
  // magenta da WonderAds) e foram validadas para fundo branco: distinguem-se
  // entre vizinhas, também para quem tem daltonismo. «Outra» é cinzenta de
  // propósito. A ordem é a do ecrã da receção — e a dos gráficos.
  sources: [
    { id: "google", label: "Google", hint: "Pesquisa ou Google Maps", color: "#2A9DB5", search: true },
    { id: "ia", label: "ChatGPT ou outra IA", hint: "Gemini, Copilot, Perplexity…", color: "#7B5CF2", search: true },
    { id: "redes", label: "Redes sociais", hint: "Facebook, Instagram…", color: "#CC4FB4" },
    { id: "recomendacao", label: "Recomendação", hint: "Família, amigos, outro paciente", color: "#97A21B" },
    { id: "medico", label: "Médico ou seguro", hint: "Encaminhado, Médis, ADSE…", color: "#3F5FC8" },
    { id: "porta", label: "Passagem à porta", hint: "Viu a clínica na rua", color: "#E58A3B" },
    { id: "outro", label: "Outra", hint: "Rádio, jornal, evento…", color: "#9AA5A6" },
  ],
  channels: [
    { id: "telefone", label: "Telefone", phrase: "por telefone" },
    { id: "whatsapp", label: "WhatsApp", phrase: "por WhatsApp" },
    { id: "balcao", label: "Ao balcão", phrase: "ao balcão" },
    { id: "online", label: "Site ou email", phrase: "pelo site ou email" },
  ],
  startDay: "2026-11-03",
  // As cores de mymedic.pt (teal #5ABDCA, lima #CAD225, texto #173435).
  theme: {
    paper: "#F3F9F9",
    ink: "#173435",
    muted: "#5E7576",
    line: "#DCEBEC",
    primary: "#5ABDCA",
    deep: "#2E7280",
    accent: "#CAD225",
    mark: "mymedic-cross",
  },
};

const CLIENTS: Record<string, OrigemClient> = {
  mymedic: MYMEDIC,
};

export function getOrigemConfig(slug: string): OrigemClient | null {
  return CLIENTS[slug] ?? null;
}

export function origemSlugs(): string[] {
  return Object.keys(CLIENTS);
}

/** O caminho da página — o que o chip abre e o que fica no tablet. */
export function origemPath(slug: string): string {
  return `/${slug}/origem`;
}

/** O id de origem guardado, ou «outro» se a origem já não existir. */
export function sourceIdOf(cfg: OrigemClient, id: string): string {
  return cfg.sources.some((s) => s.id === id) ? id : "outro";
}
