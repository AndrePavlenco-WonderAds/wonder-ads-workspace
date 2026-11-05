// Origem de Pacientes — as palavras que dependem do cliente (puro: servidor e
// browser). Fica fora de config.ts de propósito: config.ts importa o registo
// de todos os clientes, e os componentes do browser só precisam disto.

import type { OrigemClient, OrigemSite } from "./config";

/** O id de origem guardado, ou «outro» se a origem já não existir. */
export function sourceIdOf(cfg: OrigemClient, id: string): string {
  return cfg.sources.some((s) => s.id === id) ? id : "outro";
}

/** As palavras que dependem do género do local: «todas as clínicas»,
 *  «nos salões Cidália», «Nenhuma loja». */
export function placeWords(cfg: OrigemClient) {
  const f = cfg.place.gender === "f";
  return {
    all: f ? "todas" : "todos",
    allCap: f ? "Todas" : "Todos",
    /** «nas» / «nos». */
    inAll: f ? "nas" : "nos",
    none: f ? "Nenhuma" : "Nenhum",
    the: f ? "a" : "o",
  };
}

/** Onde: «em Viseu» (um local), «nas clínicas MyMedic» (todos) ou, quando o
 *  cliente só tem um local, «na MyMedic». */
export function whereLabel(cfg: OrigemClient, site: OrigemSite | null): string {
  if (site && cfg.sites.length > 1) return `em ${site.short}`;
  if (cfg.sites.length === 1) return cfg.brandOf.replace(/^da /, "na ").replace(/^do /, "no ");
  const w = placeWords(cfg);
  return `${w.inAll} ${cfg.place.many} ${cfg.brandShort}`;
}

/** O local escolhido pelo link: `?<param>=` do cliente, ou os nomes antigos. */
export function siteFromQuery(cfg: OrigemClient, params: URLSearchParams): string | null {
  for (const key of [cfg.place.param, "local", "clinica"]) {
    const v = params.get(key);
    if (v && cfg.sites.some((s) => s.id === v)) return v;
  }
  return null;
}
