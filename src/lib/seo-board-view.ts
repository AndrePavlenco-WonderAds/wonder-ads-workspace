// A vista da board do SEO DPT (v80.59) — partilhada entre a página (servidor,
// lê o cookie) e o seletor (browser, escreve-o). Fica fora do componente
// «use client»: uma constante exportada de lá chegava ao servidor como uma
// referência de cliente, não como a string.

export type SeoBoardView = "atual" | "plantel";

export const SEO_VIEW_COOKIE = "ws_seo_view";
