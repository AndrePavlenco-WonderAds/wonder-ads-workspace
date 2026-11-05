// Origem de Pacientes (v78.68) — o add-on onde a receção de um cliente regista
// como cada pessoa nova o conheceu. É a versão digital do «registo de leads»
// do mês 2 da Jornada de Cliente: em vez de um Excel que o cliente envia no
// fim do mês, a receção toca numa origem e os números ficam na ficha.
//
// Como o Reviews Hub, é um produto por cliente: só os slugs de clients.ts têm
// página (/<slug>/origem), chip no cabeçalho do SEO e API. Piloto: MyMedic;
// desde a v78.76, todos os clientes de SEO ativos (os pausados não).
//
// Módulo puro, sem segredos — vai também para o browser. O PIN de cada
// cliente vive só em access.ts (salt + hash).
//
// REGRA: os `id` de locais, origens e canais são a chave guardada em cada
// registo. Depois de haver dados, nunca se mudam — muda-se só o `label`. Uma
// origem retirada sai da lista `sources` mas os registos antigos continuam a
// contar como «Outra».

import { ORIGEM_CLIENTS } from "./clients";

export type OrigemSite = {
  id: string;
  /** «Clínica de Viseu». */
  name: string;
  /** Nome curto para pastilhas e tabelas («Viseu»). */
  short: string;
  /** A morada, uma linha por elemento — o ecrã de escolha do local mostra-a
   *  para a receção reconhecer o seu. */
  address?: string[];
};

export type OrigemSource = {
  id: string;
  label: string;
  /** Uma linha por baixo do rótulo, para a receção não hesitar. */
  hint: string;
  /** Cor da origem nos gráficos e no botão selecionado (validada para
   *  daltonismo na ordem da lista — ver presets.ts). */
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

export type OrigemPlace = {
  one: string;
  many: string;
  /** «a clínica» / «o salão». */
  the: string;
  /** «nesta clínica» / «neste salão». */
  inThis: string;
  /** Para «todas as clínicas» / «todos os salões». */
  gender: "f" | "m";
  /** O parâmetro do link que fixa o local no tablet (?clinica=viseu). */
  param: string;
};

export type OrigemClient = {
  slug: string;
  brand: string;
  /** O nome numa frase: «MyMedic», «Monte Mar». */
  brandShort: string;
  /** «da MyMedic» / «do Monte Mar». */
  brandOf: string;
  /** Palavras da página: «paciente(s)» numa clínica, «cliente(s)» num salão. */
  person: { one: string; many: string };
  place: OrigemPlace;
  /** Quem regista: «a receção», «a loja», «a equipa». */
  desk: { who: string; of: string; at: string };
  sites: OrigemSite[];
  sources: OrigemSource[];
  channels: OrigemChannel[];
  /** Primeiro dia com registos (AAAA-MM-DD) — os meses começam aqui. */
  startDay: string;
  /** As cores da marca do cliente — a página inteira veste-as. */
  theme: OrigemTheme;
  /** O logótipo para fundo claro (public/origem/<slug>/…). Sem ele, o da
   *  ficha do cliente. `h` = altura no cabeçalho, em px (40 por omissão). */
  logo?: { src: string; h?: number };
};

/** As letras disponíveis (fonts.ts) — as do site de cada cliente, ou a
 *  gratuita mais próxima quando o site usa uma letra paga. */
export type OrigemFont =
  | "manrope"
  | "montserrat"
  | "dmSans"
  | "raleway"
  | "josefin"
  | "exo2"
  | "inter"
  | "jost"
  | "nunitoSans"
  | "oswald"
  | "poppins"
  | "openSans"
  | "assistant";

/** O selo que salta a cada registo: a cruz da MyMedic (montada peça a
 *  peça), o símbolo do logótipo do cliente, ou um visto na cor da marca. */
export type OrigemMark = "mymedic-cross" | "check" | { src: string };

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
  mark: OrigemMark;
  font: OrigemFont;
  /** Letra dos títulos e dos números grandes (por omissão, a mesma). */
  display?: OrigemFont;
  /** Peso dos títulos e dos números grandes (800 por omissão). */
  heading?: number;
  /** Os cantos: «round» (os da MyMedic), «soft» ou «square». */
  shape?: "round" | "soft" | "square";
};

export function getOrigemConfig(slug: string): OrigemClient | null {
  return ORIGEM_CLIENTS[slug] ?? null;
}

export function origemSlugs(): string[] {
  return Object.keys(ORIGEM_CLIENTS);
}

/** O caminho da página — o que o chip abre e o que fica no tablet. */
export function origemPath(slug: string): string {
  return `/${slug}/origem`;
}

// As funções de texto vivem em words.ts — sem o registo dos clientes, para
// os componentes do browser as poderem usar sem levar a configuração toda.
export { placeWords, siteFromQuery, sourceIdOf, whereLabel } from "./words";
