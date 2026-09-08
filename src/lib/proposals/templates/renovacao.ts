// Template de PROPOSTA DE RENOVAÇÃO — a estrutura da proposta pública
// (/proposta/fisio-restelo-renovacao) com os dados do cliente substituídos
// por campos entre [parênteses retos]. O consultor descarrega-o do
// departamento Comercial, entrega-o ao Claude na sessão dele com o relatório
// de resultados e o roadmap, e volta com o PDF pronto para carregar.
//
// As sete secções são as que o cliente já conhece; as regras do André
// (v76.94/95) estão embutidas como notas: curto, visual, sem texto de
// ligação, branding claro, duas modalidades de pagamento.

import "server-only";
import { C, Sheet } from "./pdf-kit";

export async function buildRenovacaoTemplatePdf(): Promise<Uint8Array> {
  const s = await Sheet.create({
    title: "Template - Proposta de Renovação - Wonder Ads",
    footerText: "Wonder Ads · Template de Proposta de Renovação · info@wonder-ads.com",
  });

  s.brandBand({
    eyebrowRight: ["Proposta de renovação", "Template · Departamento Comercial"],
    title: "[Nome do Cliente] + WonderAds",
    subtitle: "Proposta de Renovação · [Mês AAAA] – [Mês AAAA]   ·   Emitida a [DD/MM/AAAA]   ·   SEO DPT",
    height: 140,
  });
  s.gap(12);

  s.note("Como usar este template (apagar antes de enviar)", [
    "Substitui tudo o que está entre [parênteses retos]. Mantém as 7 secções e a ordem — é a estrutura que os clientes já conhecem.",
    "Fontes: o relatório de resultados dos últimos 6 meses e o roadmap dos próximos 6. Todos os números da proposta vêm daí; nada é inventado.",
    "Regras da casa: curta e visual. Números e tabelas em vez de parágrafos de ligação. Branding claro (fundo branco, cartões, lilás), nunca painéis escuros. Sem secção de garantias e sem plano alternativo — só o plano proposto, com as duas modalidades de pagamento.",
    "Quando o PDF estiver pronto, volta ao departamento Comercial e usa «Carregar proposta»: a app lê o ficheiro e cria o cartão.",
  ]);
  s.gap(14);

  // ---------------------------------------------------------------- hero
  s.eyebrow("Os números que abrem a proposta");
  s.gap(6);
  s.tiles([
    { value: "[N]", label: "cliques na Pesquisa Google", sub: "últimos 6 meses" },
    { value: "[N]", label: "chamadas via perfil Google", sub: "[mês] a [mês]" },
    { value: "[N]", label: "pedidos de direções", sub: "[mês] a [mês]" },
    { value: "[N]", label: "formulários submetidos", sub: "[X]% de conclusão" },
  ]);
  s.gap(6);

  // ------------------------------------------------------------ 1. resultados
  s.h2("1. Os primeiros 6 meses em números");
  s.eyebrow("Resultados · [Mês] a [Mês] de [AAAA]");
  s.gap(8);
  s.table({
    cols: [
      { label: "Métrica", w: 3 },
      { label: "Início ([mês])", w: 1.6, align: "right" },
      { label: "Agora ([mês])", w: 1.6, align: "right" },
      { label: "Variação", w: 1.4, align: "right" },
    ],
    boldFirst: true,
    rows: [
      ["Cliques mensais na Pesquisa Google", "[N]", "[N]", "[+X%]"],
      ["Impressões mensais", "[N]", "[N]", "[+X%]"],
      ["Posição média", "[N,N]", "[N,N]", "[-N,N]"],
      ["Palavras-chave no Top 10", "[N]", "[N]", "[+N]"],
      ["Authority Score", "[N]", "[N]", "[+N]"],
      ["Domínios de referência", "[N]", "[N]", "[+N]"],
      ["Menções em respostas de IA (Searchable)", "[N]", "[N]", "[+N]"],
    ],
  });
  s.small("Gráfico na versão web: evolução mensal de cliques e impressões, mês a mês, com a barra do mês atual a crescer. No PDF, a tabela acima substitui-o.");
  s.gap(8);

  // ------------------------------------------------------------ 2. paciente
  s.h2("2. Do tráfego ao paciente");
  s.eyebrow("Conversão · O que acontece depois do clique");
  s.gap(8);
  s.table({
    cols: [
      { label: "Canal", w: 2.4 },
      { label: "Contactos", w: 1.2, align: "right" },
      { label: "Período", w: 1.6 },
      { label: "Nota", w: 3 },
    ],
    boldFirst: true,
    rows: [
      ["Chamadas via perfil Google", "[N]", "[mês] – [mês]", "[Ex.: +X% face ao semestre anterior]"],
      ["Pedidos de direções", "[N]", "[mês] – [mês]", "[Ex.: picos nas semanas de campanha]"],
      ["Formulários do site", "[N]", "[mês] – [mês]", "[X]% de quem começa conclui"],
      ["Chat / WhatsApp", "[N]", "[mês] – [mês]", "[Opcional — apagar se não se mede]"],
    ],
  });
  s.box(
    [
      { text: "[X]% de quem começa o formulário conclui-o", opts: { font: s.f.bold, color: C.green, size: 10 } },
      { text: "[Uma frase com o dado que mais impressiona neste ciclo — ex.: a página de marcação passou a ser a 2.ª mais vista do site.]", opts: { color: C.body } },
    ],
    { fill: C.greenBg, accent: C.green },
  );
  s.gap(12);

  // ------------------------------------------------------------ 3. roadmap
  s.h2("3. O plano dos próximos 6 meses");
  s.eyebrow("Roadmap SEO e Visibilidade em IA · [Mês AAAA] – [Mês AAAA]");
  s.gap(8);
  s.p("O compromisso, mês a mês. Uma linha por mês, com o foco e as entregas que o cliente vai ver.");
  s.gap(6);
  s.table({
    cols: [
      { label: "#", w: 0.5 },
      { label: "Mês", w: 1.3 },
      { label: "Foco", w: 2.4 },
      { label: "Entregas", w: 4 },
    ],
    numberFirst: true,
    boldFirst: true,
    rows: [
      ["01", "[Mês]", "[Ex.: Auditoria + arranque do cluster prioritário]", "[Ex.: auditoria técnica, 15 keywords prioritárias, 2 blogs, 1 landing page]"],
      ["02", "[Mês]", "[Foco]", "[Entregas]"],
      ["03", "[Mês]", "[Foco] · checkpoint T1", "[Entregas]"],
      ["04", "[Mês]", "[Foco]", "[Entregas]"],
      ["05", "[Mês]", "[Foco]", "[Entregas]"],
      ["06", "[Mês]", "[Foco] · checkpoint T2 e balanço", "[Entregas]"],
    ],
  });
  s.eyebrow("Quadro de metas");
  s.gap(6);
  s.table({
    cols: [
      { label: "Meta", w: 3 },
      { label: "Hoje", w: 1.4, align: "right" },
      { label: "T1 · [mês]", w: 1.4, align: "right" },
      { label: "T2 · [mês]", w: 1.4, align: "right" },
    ],
    boldFirst: true,
    rows: [
      ["Cliques mensais na Pesquisa Google", "[N]", "[N]", "[N]"],
      ["Posições do cluster prioritário", "[Top N]", "[Top 3–5]", "[Top 1–3]"],
      ["Contactos mensais (chamadas + formulários)", "[N]", "[N]", "[N]"],
      ["Menções em respostas de IA", "[N]", "[N]", "[N]"],
    ],
  });
  s.small("Na versão web, a «escada de posições» mostra a subida do cluster prioritário de hoje até à meta; aqui fica a linha da tabela.");
  s.gap(8);

  // ------------------------------------------------------------ 4. foco
  s.h2("4. Foco prioritário: [o eixo que distingue o cliente]");
  s.eyebrow("[Ex.: Escoliose · o serviço em que a clínica quer ser referência]");
  s.gap(8);
  s.p("[Duas linhas, no máximo, a dizer porque é que este eixo é o que mais vale: procura, margem, diferenciação. Sem adjetivos.]");
  s.gap(6);
  s.eyebrow("Lista de partida de palavras-chave", { color: C.grey });
  s.gap(5);
  s.pills([
    "[palavra-chave 1]",
    "[palavra-chave 2 + cidade]",
    "[palavra-chave 3]",
    "[palavra-chave 4]",
    "[palavra-chave 5]",
    "[palavra-chave 6]",
    "[palavra-chave 7]",
    "[palavra-chave 8]",
  ]);
  s.p("Meta: [Top 1–3] em [mês AAAA] para o conjunto do cluster, com [N] conteúdos novos e [N] páginas otimizadas.");
  s.gap(10);

  // ------------------------------------------------------------ 5. novo
  s.h2("5. Novo neste ciclo: [extra incluído — ex.: CRM configurado e ligado]");
  s.eyebrow("Novo neste ciclo · valor médio [1.200] € · incluído");
  s.gap(8);
  s.box(
    [
      { text: "[Nome do extra] — valor médio [1.200] €, riscado -> Incluído · 0 €", opts: { font: s.f.bold, color: C.ink, size: 10 } },
      { text: "[O que fica feito: ex.: configuração do CRM, ligação dos formulários e do chat widget, pipeline de leads, notificações à equipa.]" },
      { text: "[O que muda para o cliente: ex.: cada contacto entra num só sítio, com origem e estado; ninguém fica sem resposta.]" },
    ],
    { fill: C.lilac, accent: C.purple },
  );
  s.gap(12);

  // ------------------------------------------------------------ 6. plano
  s.h2("6. Plano e investimento");
  s.eyebrow("Plano · Exclusivamente personalizado para [o cliente]");
  s.gap(8);
  s.p("Plano de Crescimento Orgânico · [Mês AAAA] – [Mês AAAA] · 6 meses · duas modalidades de pagamento", { font: s.f.bold, color: C.ink });
  s.gap(8);
  s.priceTiles(
    { eyebrow: "Plano mensal", value: "[6.000] €", sub: "[1.000] €/mês x 6 meses" },
    { eyebrow: "Pré-pago", value: "[5.400] €", sub: "pagamento único, tudo à cabeça", badge: "Poupa [600] €" },
  );
  s.bullets([
    "[Extra] configurado e ligado — [1.200] € incluídos",
    "Plataforma WonderAds incluída (97 €/mês à parte)",
    "Relatório mensal + checkpoints em [mês] e [mês]",
    "Resposta em 30 minutos, em horário útil",
  ]);
  s.gap(6);
  const groups: [string, string[]][] = [
    ["Conteúdo & SEO", ["Auditorias regulares", "Roadmap de 6 meses", "15 palavras-chave prioritárias", "Blogs e landing pages", "[serviços do cliente separados por ·]", "Velocidade e imagens", "SEO técnico", "300 backlinks", "Domínios de referência"]],
    ["Medição & CRM", ["GA4", "Medição de contactos por canal", "NOVO · [extra incluído]", "Chat widget -> CRM", "Relatório mensal", "Checkpoints [mês] · [mês]"]],
    ["Google & IA", ["Marcação direta no perfil Google", "Posts e reviews", "Presença em IA (Searchable + AI Visibility)", "Citabilidade (AEO)"]],
    ["On-page incluído", ["Títulos e descrições meta", "URLs", "Alt tags", "Links internos e externos"]],
  ];
  for (const [title, items] of groups) {
    s.eyebrow(title, { color: C.violetDeep });
    s.gap(5);
    s.pills(items, { strongPrefix: "NOVO" });
  }
  s.small("Valores em euros. Acresce IVA à taxa legal em vigor.");
  s.gap(10);

  // ------------------------------------------------------------ 7. avançar
  s.h2("7. Próximos passos");
  s.eyebrow("Para avançar");
  s.gap(8);
  s.box(
    [
      { text: "Confirmar a renovação", opts: { font: s.f.bold, color: C.ink, size: 11 } },
      { text: "1. O cliente responde a este e-mail (ou confirma na página da proposta) com a modalidade escolhida: mensal [6.000] € ou pré-pago [5.400] €." },
      { text: "2. Primeira call de arranque do novo ciclo: [fim de mês / data]." },
      { text: "3. Arranque do plano: [Mês AAAA]. O relatório do 1.º mês sai a [DD/MM/AAAA]." },
      { text: "Dúvidas? [Nome do consultor] · [email]@wonder-ads.com", opts: { color: C.violetDeep, font: s.f.bold } },
    ],
    { fill: C.white, stroke: C.lilacLine, accent: C.purple },
  );
  s.gap(12);
  s.small("Nota metodológica — fontes e períodos: [Pesquisa Google: série mensal de [mês] a [mês], meses completos] · [Perfil Google: [mês] a [mês]] · [Site: desde a ativação da medição a [data]] · [Semrush Domain Overview de [data]] · [Searchable: [mês], N prompts não-branded].");
  s.gap(10);
  s.rule();
  s.gap(6);
  s.small("Wonder Ads · Agência de crescimento para Saúde & Bem-Estar · #1 SEO Provider em Portugal · www.wonder-ads.com · info@wonder-ads.com", { align: "center" });

  return s.finish();
}
