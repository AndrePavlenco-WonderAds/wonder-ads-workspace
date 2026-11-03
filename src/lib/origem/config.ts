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

export type OrigemChannel = { id: string; label: string };

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
  /** Cores da marca do cliente, para os detalhes da página. */
  accent: { primary: string; soft: string; light: string; lime: string };
};

const MYMEDIC: OrigemClient = {
  slug: "mymedic",
  brand: "MyMedic Clínicas",
  person: { one: "paciente", many: "pacientes" },
  place: { one: "clínica", many: "clínicas", the: "a clínica", inThis: "nesta clínica" },
  // As duas clínicas de mymedic.pt/contactos (03/11/2026). Confirmar com o
  // cliente antes de ligar o tablet.
  sites: [
    { id: "viseu", name: "Clínica de Viseu", short: "Viseu" },
    { id: "fornos", name: "Clínica de Fornos de Algodres", short: "Fornos de Algodres" },
  ],
  // As cores misturam as duas marcas: azuis, lima e sálvia da MyMedic;
  // violeta e magenta da WonderAds. A ordem é a do ecrã da receção.
  sources: [
    { id: "google", label: "Google", hint: "Pesquisa ou Google Maps", color: "#6EC1D6", search: true },
    { id: "ia", label: "ChatGPT ou outra IA", hint: "Gemini, Copilot, Perplexity…", color: "#8B7CF6", search: true },
    { id: "redes", label: "Redes sociais", hint: "Facebook, Instagram…", color: "#D45AD6" },
    { id: "recomendacao", label: "Recomendação", hint: "Família, amigos, outro paciente", color: "#C9D22B" },
    { id: "medico", label: "Médico ou seguro", hint: "Encaminhado, Médis, ADSE…", color: "#F0A35E" },
    { id: "porta", label: "Passagem à porta", hint: "Viu a clínica na rua", color: "#9FC08A" },
    { id: "outro", label: "Outra", hint: "Rádio, jornal, evento…", color: "#8A8FA3" },
  ],
  channels: [
    { id: "telefone", label: "Telefone" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "balcao", label: "Ao balcão" },
    { id: "online", label: "Site ou email" },
  ],
  startDay: "2026-11-03",
  accent: { primary: "#3E7486", soft: "#8CC2D0", light: "#E8F4F7", lime: "#C9D22B" },
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
