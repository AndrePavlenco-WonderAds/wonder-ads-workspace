// Alterações às páginas da Documentação feitas em CÓDIGO (v78.62) — o
// registo que o sino do SEO DPT lê ao lado das edições feitas na app.
//
// REGRA: sempre que uma versão nova mexe numa página da Documentação em
// código — documento novo, regra nova, acrescento, uma regra alterada ou
// removida — acrescenta-se uma entrada AQUI, à cabeça, na mesma versão.
// Sem entrada, a equipa não sabe que a regra mudou. Atualiza também o
// `updatedAt` do bloco em blocks.ts (é a data que a página mostra). Mudanças só de aspeto
// (cores, espaçamentos, capa) não levam entrada.
//
// Cada entrada:
//   id        único e estável («v78.62-bonus-nps-patamar») — é o id do aviso;
//             mudá-lo depois faz o aviso voltar a aparecer por ler a todos
//   page      o `DocsPage.id` (blocks.ts); para uma página removida, o id
//             antigo + `blockId` do bloco (sem bloco, vai ao hub)
//   kind      "nova" | "regra" | "add-on" | "alterada" | "removida"
//   changes   o que mudou, em frases curtas, como se lê no sino
//   at        data e hora da versão, em ISO com fuso: "2026-10-30T18:00:00+00:00"
//   anchor    opcional — a secção da página para onde o botão leva
//
// Exemplo:
//   {
//     id: "v78.70-bonus-nps-patamar",
//     page: "bonus-nps",
//     kind: "regra",
//     changes: ["Patamar novo: média 9,75 → 200 €"],
//     at: "2026-11-04T10:00:00+00:00",
//     version: "78.70",
//     anchor: "patamares",
//   },

import type { DocUpdate, DocUpdateKind } from "./updates";

export type CodeDocUpdate = {
  id: string;
  page: string;
  blockId?: string;
  kind: DocUpdateKind;
  changes: string[];
  at: string;
  version: string;
  anchor?: string;
};

export const CODE_DOC_UPDATES: CodeDocUpdate[] = [];

/** As entradas de código na forma comum. */
export function codeDocUpdates(): DocUpdate[] {
  return CODE_DOC_UPDATES.map((c) => {
    const at = Date.parse(c.at);
    return {
      id: c.id,
      page: c.page,
      ...(c.blockId ? { blockId: c.blockId } : {}),
      kind: c.kind,
      changes: c.changes,
      by: "Direção",
      byUsername: null,
      source: "codigo" as const,
      at,
      updatedAt: at,
      version: c.version,
      ...(c.anchor ? { anchor: c.anchor } : {}),
    };
  }).filter((u) => Number.isFinite(u.at));
}
