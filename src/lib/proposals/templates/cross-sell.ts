// Template de PROPOSTA DE CROSS-SELL — a estrutura do orçamento de serviço
// pontual (o da sessão fotográfica da MIMUS, setembro de 2026) com tudo o
// que era do cliente substituído por campos entre [parênteses retos].
// Serve para qualquer serviço vendido a um cliente que já é nosso: sessão
// fotográfica, vídeo, CRM, landing page, redesign…
//
// Duas páginas: (1) faixa da marca, ficha do cliente, âmbito, tabela de
// itens, total, incluído/não incluído; (2) licença/direitos, condições
// comerciais, responsabilidades do cliente, nota de enquadramento,
// assinaturas.

import "server-only";
import { C, CONTENT_W, MARGIN, Sheet, spaced } from "./pdf-kit";

export async function buildCrossSellTemplatePdf(): Promise<Uint8Array> {
  const s = await Sheet.create({
    title: "Template - Proposta de Cross-sell - Wonder Ads",
    footerText: "Wonder Ads · Template de Proposta de Cross-sell · [departamento] · [consultor]@wonder-ads.com",
  });

  s.brandBand({
    eyebrowRight: ["[Departamento — ex.: Produção de conteúdo]", "Proposta de orçamento"],
    title: "[Nome do serviço]",
    subtitle: "[Nome do Cliente] · [Localidade]",
    height: 140,
  });
  s.gap(12);

  s.note("Como usar este template (apagar antes de enviar)", [
    "Substitui tudo o que está entre [parênteses retos] — o título é o nome do serviço (ex.: «Sessão Fotográfica Profissional»). Mantém as secções: a ficha de cliente, o âmbito, a tabela de itens com «Incluído» e o valor total no fim, o par incluído / não incluído, as condições e as assinaturas.",
    "Referência: WA-[AAAA]-[MM]-[CLIENTE]-[SERVIÇO]-01. Validade: 30 dias a contar da emissão. Valores sem IVA.",
    "Nota de enquadramento: liga o serviço a uma conclusão concreta da auditoria ou do relatório do cliente (com data) — é o que transforma um orçamento num cross-sell.",
    "Quando o PDF estiver pronto, volta ao departamento Comercial e usa «Carregar proposta»: a app lê o ficheiro e cria o cartão.",
  ]);
  s.gap(14);

  // ------------------------------------------------------------ ficha
  {
    const cols = 4;
    const w = CONTENT_W / cols;
    const blocks: [string, string[]][] = [
      ["Cliente", ["[Nome do Cliente]", "[Morada]", "[Código postal] [Localidade]"]],
      ["A/C", ["[Nome do decisor]", "[Cargo]", "[Telefone]"]],
      ["Data / Validade", ["Emitido: [DD de Mês de AAAA]", "Válido até: [DD de Mês de AAAA]"]],
      ["Referência", ["WA-[AAAA]-[MM]-[CLI]-[SERV]-01", "[consultor]@wonder-ads.com", "wonder-ads.com"]],
    ];
    s.ensure(64);
    const top = s.y;
    blocks.forEach(([label, lines], k) => {
      const x = MARGIN + k * w;
      s.textAt(spaced(label), x, top, { size: 6, font: s.f.bold, color: C.purple, maxW: w - 8 });
      let yy = top - 14;
      for (const line of lines) {
        yy -= s.textAt(line, x, yy, { size: 8.6, color: C.body, maxW: w - 10, lineHeight: 12 });
      }
    });
    s.y = top - 64;
  }
  s.gap(4);

  // ------------------------------------------------------------ âmbito
  s.h2("Âmbito do serviço");
  s.p("[Dois a três períodos a descrever o serviço e o que o cliente fica a ter. Ex.: Produção fotográfica no local, orientada à criação de um banco de imagens próprio e autêntico da clínica — equipa, instalações e prática clínica — para utilização em website, Google Business Profile, redes sociais e materiais institucionais.]");
  s.gap(10);
  s.table({
    cols: [
      { label: "#", w: 0.45 },
      { label: "Descrição", w: 2.4 },
      { label: "Detalhe", w: 4.4 },
      { label: "Valor", w: 0.9, align: "right" },
    ],
    numberFirst: true,
    boldFirst: true,
    rows: [
      ["01", "[Item principal — ex.: Sessão fotográfica com staging clínico]", "[O que inclui, em 2–3 linhas: cenários, quantidades, direção de cena.]", "Incluído"],
      ["02", "[Deslocação e equipamento]", "[Deslocação de profissional às instalações em [Localidade], equipamento: …]", "Incluído"],
      ["03", "[Permanência / duração]", "[Até N horas, incluindo montagem, captação e desmontagem.]", "Incluído"],
      ["04", "[Pós-produção e entrega]", "[Seleção e edição de até N peças; formato e forma de entrega.]", "Incluído"],
      ["05", "[Licença de uso / direitos]", "[Licença de utilização comercial própria, sem limite temporal, para os canais do cliente.]", "Incluído"],
    ],
  });
  {
    s.ensure(34);
    const top = s.y;
    s.page.drawLine({ start: { x: MARGIN, y: top }, end: { x: MARGIN + CONTENT_W, y: top }, thickness: 1.2, color: C.purple });
    s.textAt("Valor total do serviço", MARGIN + 10, top - 8, { size: 11, font: s.f.bold, color: C.ink });
    s.textAt("[700] €", MARGIN, top - 6, { size: 15, font: s.f.bold, color: C.purple, maxW: CONTENT_W - 10, align: "right" });
    s.y = top - 30;
  }
  s.small("Valores em euros. Acresce IVA à taxa legal em vigor.", { align: "right" });
  s.gap(12);

  // ------------------------------------------------------------ incluído
  s.h2("O que está incluído e o que não está");
  s.twoColumnLists(
    {
      title: "Incluído",
      items: [
        "[Reunião prévia de alinhamento — o que se vai produzir]",
        "[Deslocação e montagem]",
        "[Direção / acompanhamento com a equipa do cliente]",
        "[Entregável principal, com quantidade — ex.: até 40 imagens editadas em alta resolução]",
        "[Versões otimizadas para web]",
        "[Acesso / galeria privada durante N meses]",
        "[Arquivo dos originais por N meses]",
      ],
    },
    {
      title: "Não incluído",
      color: C.grey,
      items: [
        "[Recursos externos — modelos, atores, figurantes]",
        "[Aluguer de props, mobiliário ou fardamento]",
        "[Outros formatos — vídeo, reels, timelapse]",
        "[Entregas para além das N previstas]",
        "[Sessões adicionais ou horas extra além das N horas]",
        "[Retoque / trabalho avançado fora do âmbito]",
        "[Cedência de direitos a terceiros ou revenda]",
      ],
    },
  );

  // ------------------------------------------------------------ licença
  s.gap(14);
  s.h2("Licença de uso");
  s.box(
    [
      { text: "[O Cliente] recebe uma licença de utilização comercial, não exclusiva e sem limite temporal, para [os entregáveis], aplicável a: website institucional, Google Business Profile, redes sociais, campanhas pagas, newsletters, materiais impressos e sinalética." },
      { text: "Fora do âmbito da licença: revenda, sublicenciamento ou cedência a terceiros; alteração substancial que descaracterize o conteúdo; utilização por entidades distintas de [o Cliente]. Os direitos de autor permanecem na esfera de [do autor / da agência], que reserva o direito de utilizar uma seleção em portefólio, salvo indicação escrita em contrário." },
    ],
    { fill: C.lilac, accent: C.purple },
  );
  s.gap(12);

  s.h2("Condições comerciais");
  s.keyValues([
    ["Prazo de entrega", "[7 a 10 dias úteis após a data da sessão / do arranque]."],
    ["Formatos entregues", "[Ex.: JPEG em alta resolução e versões comprimidas otimizadas para web, prontas a publicar.]"],
    ["Condições de pagamento", "50% na adjudicação (confirma a reserva de data) e 50% na entrega final."],
    ["Agendamento", "Data a definir com um mínimo de [10] dias de antecedência, em função da disponibilidade do cliente."],
    ["Reagendamento", "Sem custo até 48 horas antes. Dentro desse prazo, aplica-se [30]% do valor total."],
    ["Horas / unidades adicionais", "Sob orçamento prévio, caso o serviço exceda o previsto."],
    ["Validade da proposta", "30 dias a contar da data de emissão."],
  ]);
  s.gap(8);

  s.h2("Da responsabilidade do cliente");
  s.box(
    [
      { text: "Consentimentos (RGPD). [Recolha prévia de consentimento escrito para captação e utilização de imagem de colaboradores e profissionais. Se envolver pacientes, consentimento informado específico — a WonderAds fornece as minutas.]" },
      { text: "Logística. [Espaço disponível, acessos, ponto de contacto interno.]" },
      { text: "Apresentação. [Fardamento, espaços arrumados, sem marcas terceiras nos planos.]" },
      { text: "Conformidade [OMD / ERS / setor]. [Sem elementos que sugiram garantia de resultado ou comparação com concorrentes; validação por [responsável clínico] antes de publicação.]" },
    ],
    { fill: C.pink, accent: C.magenta },
  );
  s.gap(12);

  s.h2("Nota de enquadramento");
  s.p("[Este serviço responde a uma conclusão concreta da auditoria SEO de [DD de Mês de AAAA] (ref. [AAAA-MM-DD-xx]) / do relatório de [mês]: ex.: a dependência de fotografia de stock genérica nos ativos visuais do site, incluindo a imagem OG da homepage. Ativos próprios reforçam o sinal E-E-A-T em contexto YMYL e permitem substituir o que veio do template original.]");
  s.gap(22);

  s.signatures("Pela WonderAds — Data e assinatura", "Por [o Cliente] — Data e assinatura");
  s.gap(8);
  s.small("Documento emitido para efeitos de proposta comercial. A adjudicação pressupõe aceitação integral das condições descritas. [Todos os ativos produzidos ao abrigo deste orçamento passam a ser propriedade de utilização de [o Cliente] nos termos da licença acima, mantendo-se a titularidade dos direitos de autor em [autor].]");

  return s.finish();
}
