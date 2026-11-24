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

export const CODE_DOC_UPDATES: CodeDocUpdate[] = [
  {
    id: "v80.32-comissoes-consultoria-comercial",
    page: "comissoes",
    kind: "add-on",
    changes: [
      "Cross-sell novo: Consultoria Comercial. Programa de 3 meses com 10 sessões online, 1 dia presencial e revisão semanal de chamadas, a 7.500 € a pronto ou 9.000 € em 3 prestações (+ IVA).",
      "O serviço todo (fases, sessões com exemplos, guiões, KPIs, perguntas do cliente e valores) está na página própria, que se abre a partir do cartão.",
    ],
    at: "2026-11-24T12:00:00+00:00",
    version: "80.32",
    anchor: "cross-sells",
  },
  {
    id: "v80.25-ineficacias-reportar-antes-do-tl",
    page: "ineficacias",
    kind: "regra",
    changes: [
      "Tens até o team leader registar a ineficácia para a reportares tu: é sempre melhor admitires o erro antes de ser ele a registá-lo na app. Mão no peito e transparência quando erramos.",
    ],
    at: "2026-11-23T15:00:00+00:00",
    version: "80.25",
    anchor: "reportar",
  },
  {
    id: "v80.24-obrigatorio-gravacao-sexta",
    page: "protocolos-obrigatorios",
    kind: "regra",
    changes: [
      "Protocolo novo: todas as sextas-feiras, até ao fim do dia, envia ao team leader a gravação de uma reunião da semana (sem reuniões, vai uma de semanas anteriores). Serve para a equipa aprender com as que correm bem e com as que correm menos bem.",
    ],
    at: "2026-11-23T14:30:00+00:00",
    version: "80.24",
    anchor: "lista",
  },
  {
    id: "v80.24-proibidos-reunioes-e-respostas",
    page: "protocolos-proibidos",
    kind: "regra",
    changes: [
      "Proibido: reuniões sobrepostas no calendário, aceites ou apenas propostas, com clientes ou internas.",
      "Proibido: um cliente mais de 1 hora sem resposta no grupo durante o horário do consultor da conta (exceção: o consultor está em reunião).",
    ],
    at: "2026-11-23T14:30:00+00:00",
    version: "80.24",
    anchor: "lista",
  },
  {
    id: "v80.19-bonus-nps-clientes-novos",
    page: "bonus-nps",
    kind: "regra",
    changes: [
      "Clientes novos: um cliente que arrancou no próprio mês já não conta para a taxa de preenchimento (da equipa e tua), a menos que responda. Continua a contar para o mínimo de projetos do bónus individual.",
    ],
    at: "2026-11-23T12:00:00+00:00",
    version: "80.19",
    anchor: "como-se-mede",
  },
  {
    // v80.10: o SOP sai da revisão e abre ao SEO DPT — é esta a entrada que
    // a equipa recebe no sino (a da v80.7, só para SuperAdmins, saiu).
    id: "v80.10-sop-comunicacao-publicado",
    page: "sop-comunicacao",
    kind: "nova",
    changes: [
      "Documento novo: o SOP de Comunicação do SEO DPT. Onde, quando e como a equipa comunica: os grupos da comunidade de WhatsApp e o Slack com o tempo de resposta de cada um, a semana-tipo com as três reuniões, o Daily Update com «Por fazer», as cinco regras de escrita, o ODE em qualquer pedido e o template de pedido à direção.",
      "A regra que não falha: nenhum pedido à direção chega sem a tua sugestão de solução. Falhar uma regra do SOP conta como ineficácia («Processo não seguido»).",
    ],
    at: "2026-11-19T19:05:00+00:00",
    version: "80.10",
  },
  {
    id: "v78.73-jornada-registo-leads-tablet",
    page: "jornada-cliente",
    kind: "add-on",
    changes: [
      "Mês 2, «Registo de leads e origem dos clientes»: todos os clientes passam a ter uma página de registo na receção, aberta num tablet ou no computador. A receção regista cada pessoa nova em dois toques (origem e canal) e os números ficam contados por mês e por clínica.",
      "O passo a passo foi atualizado (pedir a página e o PIN à direção, ligar o aparelho da receção) e traz o exemplo da MyMedic. O modelo de Excel fica como alternativa enquanto a página do cliente não está pronta.",
    ],
    at: "2026-11-05T12:00:00+00:00",
    version: "78.73",
  },
  {
    id: "v78.67-jornada-cliente-meses-1-3",
    page: "jornada-cliente",
    kind: "add-on",
    changes: [
      "Tarefa nova em Mês 1: «Confirmar que todos os contactos do site são medidos no GTM/GA4» (telefone, WhatsApp, formulário e direções). Sem isto, o registo de leads do mês 2 já começa incompleto.",
      "Tarefa nova em Mês 3: «Avaliar uma reunião presencial com o cliente», com o team leader e o consultor (só clientes de Portugal continental).",
    ],
    at: "2026-11-03T17:50:00+00:00",
    version: "78.67",
  },
];

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
