// Perguntas dos testes da Formação, por módulo.
//
// SÃO RASCUNHOS DE PARTIDA, não escritura sagrada: foram redigidas a partir
// dos títulos das aulas e das notas de conteúdo do programa, antes de os
// vídeos existirem. Tudo isto é editável no CMS (/formacao/admin) sem tocar
// em código — e deve ser afinado assim que cada vídeo for gravado, para o
// teste avaliar o que foi mesmo dito.
//
// Critério de escrita:
//  • CATEGORIA COMUM — mentalidade de campeão. As perguntas não testam
//    memória de organograma; testam se a pessoa percebeu o padrão de
//    exigência e o que é a SUA responsabilidade quando algo não corre bem.
//  • ESPECIALIZAÇÕES — responsabilidade concreta do departamento e o cuidar
//    da conta do cliente: o que é entregue, em que prazo, por quem, e o que
//    fazer quando falha.
//
// Só se usam tipos auto-corrigíveis (escolha múltipla, múltipla seleção,
// verdadeiro/falso). Perguntas de resposta aberta existem no modelo e no CMS,
// mas ficam de fora do seed: não são corrigíveis automaticamente e chumbar
// alguém por causa disso seria injusto (o motor trata-as como revisão manual).

import type { TrainingQuestion } from "@/lib/training/catalog";

/** Escolha múltipla / múltipla seleção. `opts` = [texto, é correta]. */
function q(
  id: string,
  prompt: string,
  opts: [string, boolean][],
  explanation: string,
  order: number,
): TrainingQuestion {
  const correct = opts.filter(([, c]) => c).length;
  return {
    id,
    prompt,
    type: correct > 1 ? "multi_select" : "multiple_choice",
    order,
    points: 1,
    options: opts.map(([text, isCorrect], i) => ({
      id: `${id}-o${i + 1}`,
      text,
      isCorrect,
    })),
    explanation,
  };
}

/** Verdadeiro/falso. */
function tf(
  id: string,
  prompt: string,
  answer: boolean,
  explanation: string,
  order: number,
): TrainingQuestion {
  return {
    id,
    prompt,
    type: "true_false",
    order,
    points: 1,
    options: [
      { id: `${id}-v`, text: "Verdadeiro", isCorrect: answer },
      { id: `${id}-f`, text: "Falso", isCorrect: !answer },
    ],
    explanation,
  };
}

/** Constrói a lista já numerada a partir de fábricas de perguntas. */
function build(
  prefix: string,
  items: ((id: string, order: number) => TrainingQuestion)[],
): TrainingQuestion[] {
  return items.map((make, i) => make(`${prefix}-q${i + 1}`, i + 1));
}

const mc =
  (prompt: string, opts: [string, boolean][], explanation: string) =>
  (id: string, order: number) =>
    q(id, prompt, opts, explanation, order);

const vf =
  (prompt: string, answer: boolean, explanation: string) =>
  (id: string, order: number) =>
    tf(id, prompt, answer, explanation, order);

// ===========================================================================
// CATEGORIA COMUM — mentalidade de campeão e responsabilidade
// ===========================================================================

const COMUM_M1 = build("comum-m1", [
  mc(
    "Qual é o padrão de referência para o trabalho de um consultor WonderAds?",
    [
      ["Ser o melhor consultor que aquele cliente alguma vez teve", true],
      ["Entregar o que está no contrato, nem mais nem menos", false],
      ["Ser mais rápido do que a agência anterior do cliente", false],
      ["Cumprir as horas previstas para a conta", false],
    ],
    "O contrato é o mínimo, não o objetivo. A régua é a experiência que o cliente tem connosco comparada com tudo o que já viveu antes.",
  ),
  mc(
    "Um cliente teu não responde há três dias a um pedido que bloqueia o trabalho. De quem é a responsabilidade de desbloquear?",
    [
      ["Tua: insistes, mudas de canal e, se for preciso, ligas", true],
      ["Do cliente — o pedido foi enviado, a bola está do lado dele", false],
      ["Do C-Level, que deve intervir junto do cliente", false],
      ["De ninguém: regista-se como bloqueio e espera-se", false],
    ],
    "Um pedido enviado não é um problema resolvido. Enquanto o trabalho estiver parado, a responsabilidade de o pôr a andar é de quem é dono da conta.",
  ),
  vf(
    '"Eu fiz a minha parte, o resto não é comigo" é uma resposta aceitável quando o trabalho de outra pessoa atrasa o cliente.',
    false,
    "Aqui a responsabilidade é pelo resultado no cliente, não pela tarefa individual. O que se espera é que sinalizes e ajudes a destravar — não que fiques à espera de ter razão.",
  ),
  mc(
    "O que caracteriza a mentalidade de campeão no dia a dia? (escolhe todas as que se aplicam)",
    [
      ["Antecipar o problema antes de o cliente o notar", true],
      ["Levantar a mão cedo quando algo está a correr mal", true],
      ["Procurar o padrão mais alto mesmo em contas pequenas", true],
      ["Aceitar um resultado fraco desde que as horas tenham sido cumpridas", false],
    ],
    "Antecipar, comunicar cedo e não negociar o padrão consoante o tamanho da conta.",
  ),
  mc(
    "Os valores da empresa servem sobretudo para:",
    [
      ["Decidir como agir quando ninguém está a ver", true],
      ["Comunicar a marca no site e nas propostas", false],
      ["Servir de critério de avaliação anual", false],
      ["Dar contexto histórico sobre a fundação", false],
    ],
    "Valores que não mudam decisões concretas são decoração. O teste é o que fazes quando ninguém confirma.",
  ),
  mc(
    "Um mês de resultados fracos numa conta tua. O que faz um campeão?",
    [
      ["Prepara a leitura do que falhou, o plano de correção e leva-o ao cliente antes de ele perguntar", true],
      ["Espera pela reunião mensal e responde se o tema surgir", false],
      ["Foca a apresentação nas métricas que subiram", false],
      ["Justifica com fatores externos para proteger a relação", false],
    ],
    "Más notícias envelhecem mal. Quem as traz primeiro, com plano, mantém a confiança; quem as esconde perde-a de uma vez.",
  ),
  vf(
    "Profissionalismo perante o cliente só conta nas reuniões formais.",
    false,
    "Conta em tudo o que o cliente vê: uma mensagem escrita à pressa, um atraso não avisado ou um documento mal formatado dizem tanto como uma reunião.",
  ),
  mc(
    "A visão da empresa existe para:",
    [
      ["Dar um destino comum que orienta as decisões do dia a dia", true],
      ["Ser apresentada aos clientes na reunião inicial", false],
      ["Definir as metas comerciais do trimestre", false],
      ["Registar a história da fundação da WonderAds", false],
    ],
    "A visão é o destino; os objetivos anuais são as etapas. Sem destino, cada decisão é tomada às cegas.",
  ),
  mc(
    "A «responsabilidade de campeão» sobre uma conta inclui: (escolhe todas)",
    [
      ["Conhecer o estado da conta a qualquer momento, sem ter de ir procurar", true],
      ["Garantir que o cliente sabe o que foi feito e o que vem a seguir", true],
      ["Escalar a tempo o que não consegues resolver sozinho", true],
      ["Assumir sozinho decisões que ultrapassam o teu âmbito, para não incomodar ninguém", false],
    ],
    "Dono da conta não é quem decide tudo sozinho — é quem sabe sempre onde a conta está e nunca deixa o cliente no escuro.",
  ),
  mc(
    "Cometeste um erro numa entrega e o cliente ainda não deu por isso. O que fazes?",
    [
      ["Corriges e comunicas, explicando o que aconteceu e o que muda", true],
      ["Corriges em silêncio e não levantas o tema", false],
      ["Esperas para ver se o cliente chega a notar", false],
      ["Comunicas apenas se o erro tiver impacto financeiro", false],
    ],
    "Um erro comunicado por ti custa uma conversa. Descoberto pelo cliente, custa a confiança — e a confiança é o que sustenta a parceria.",
  ),
  vf(
    "Numa conta pequena é aceitável baixar o nível de exigência, porque o valor faturado é menor.",
    false,
    "O tamanho da conta não muda o padrão. Contas pequenas bem tratadas crescem, recomendam e transformam-se em casos — as maltratadas saem e falam.",
  ),
  mc(
    "O que distingue um profissional de um mero executor de tarefas?",
    [
      ["O profissional responde pelo resultado; o executor responde pela tarefa", true],
      ["O profissional trabalha mais horas", false],
      ["O profissional domina mais ferramentas", false],
      ["O profissional tem mais anos de experiência", false],
    ],
    "Ferramentas e horas aprendem-se. Responder pelo resultado é uma decisão diária.",
  ),
]);

const COMUM_M2 = build("comum-m2", [
  mc(
    "Tens uma dúvida que te bloqueia há 20 minutos. O que fazes primeiro?",
    [
      ["Identificas quem é o responsável por aquele assunto e perguntas diretamente", true],
      ["Continuas a tentar sozinho até resolver", false],
      ["Escreves no canal geral à espera que alguém responda", false],
      ["Deixas o tema para a próxima reunião de equipa", false],
    ],
    "Saber a quem perguntar é metade da velocidade de execução. Insistir sozinho num bloqueio é tempo do cliente a arder.",
  ),
  vf(
    "Perguntar a quem sabe é sinal de pouca autonomia e deve ser evitado.",
    false,
    "O contrário: autonomia é resolver depressa, e isso passa por saber quem desbloqueia o quê. O que se evita é perguntar sem ter tentado, ou perguntar à pessoa errada.",
  ),
  mc(
    "Para que serve conheceres o organograma e os departamentos? (escolhe todas)",
    [
      ["Saber quem desbloqueia cada tipo de assunto", true],
      ["Escalar pela via certa quando algo trava", true],
      ["Encaminhar uma oportunidade para a pessoa certa", true],
      ["Saber quem ganha mais dentro da equipa", false],
    ],
    "O organograma é um mapa de desbloqueio, não uma hierarquia de estatuto.",
  ),
  mc(
    "As ferramentas da casa devem ser usadas porque:",
    [
      ["Mantêm o trabalho registado e visível para quem precisar de continuar", true],
      ["São obrigatórias por contrato", false],
      ["São mais baratas do que as alternativas", false],
      ["Só assim as horas contam para efeitos de pagamento", false],
    ],
    "Trabalho que só existe na cabeça de uma pessoa desaparece nas férias, na doença e na saída. O registo é o que torna a equipa substituível sem o cliente sofrer.",
  ),
  vf(
    "Podes usar uma ferramenta pessoal em vez da ferramenta da casa se fores mais rápido nela.",
    false,
    "A velocidade individual não compensa o custo de o trabalho ficar fora do sítio onde a equipa o encontra. Se a ferramenta da casa é pior, isso é um tema a levantar — não a contornar em silêncio.",
  ),
  mc(
    "Ao dar feedback a um colega, o mais importante é:",
    [
      ["Ser específico sobre o comportamento e o seu efeito, não sobre a pessoa", true],
      ["Suavizar o suficiente para ninguém ficar desconfortável", false],
      ["Esperar pela avaliação formal para reunir tudo de uma vez", false],
      ["Dar o feedback à frente da equipa para servir de exemplo", false],
    ],
    "Feedback útil descreve o que aconteceu e o que provocou. Feedback sobre a pessoa gera defesa; feedback guardado apodrece.",
  ),
  mc(
    "Recebes feedback de que a tua comunicação com um cliente foi seca. Qual é a resposta correta?",
    [
      ["Ouvir, perguntar por um exemplo concreto e ajustar", true],
      ["Explicar por que razão o cliente estava a ser difícil naquele dia", false],
      ["Aceitar sem comentar e continuar como estavas", false],
      ["Pedir que o feedback passe a ser dado por escrito e só pelo teu superior", false],
    ],
    "Pedir um exemplo transforma uma opinião em algo acionável. Justificar de imediato fecha a porta ao próximo feedback.",
  ),
  vf(
    "Feedback que não se diz deixa de ser um problema.",
    false,
    "Deixa de ser dito, não de existir. Cresce em silêncio e aparece mais tarde, maior e mais difícil de resolver.",
  ),
  mc(
    "Um assunto urgente exige uma decisão que ultrapassa o teu âmbito e o responsável direto não está disponível. O que fazes?",
    [
      ["Escalas para o nível seguinte, com o contexto e a tua recomendação", true],
      ["Decides sozinho e informas depois", false],
      ["Esperas pelo responsável, mesmo que o cliente fique parado", false],
      ["Devolves a decisão ao cliente", false],
    ],
    "Escalar não é passar o problema: é entregá-lo com contexto e com uma proposta. Isso é o que distingue escalar de despachar.",
  ),
  mc(
    "Onde deve ficar o registo do que combinaste com um cliente numa chamada?",
    [
      ["Nas ferramentas da casa, acessível a quem trabalha a conta", true],
      ["Nas tuas notas pessoais, para consultares quando precisares", false],
      ["No email, que já serve de histórico", false],
      ["Só na tua memória, se a chamada foi curta", false],
    ],
    "O que foi combinado é informação da conta, não tua. Se amanhã outra pessoa entrar na conta, tem de conseguir seguir sem te ligar.",
  ),
  mc(
    "O que é que a equipa espera de ti quando entras numa ferramenta nova? (escolhe todas)",
    [
      ["Aprender o suficiente para não bloquear os outros", true],
      ["Perguntar quando não sabes, em vez de deixar trabalho por fazer", true],
      ["Manter o registo nessa ferramenta atualizado", true],
      ["Esperar por formação formal antes de a usares", false],
    ],
    "A formação ajuda, mas ninguém espera por ela para começar a manter o seu trabalho registado.",
  ),
]);

const COMUM_M3 = build("comum-m3", [
  mc(
    "O cliente escreve fora de horas com um assunto não urgente. O que fazes?",
    [
      ["Respondes no horário seguinte, dentro do tempo de resposta acordado", true],
      ["Respondes imediatamente, para mostrar disponibilidade", false],
      ["Esperas que ele repita o pedido em horário normal", false],
      ["Encaminhas para o C-Level", false],
    ],
    "Responder sempre de imediato cria uma expectativa que ninguém consegue manter. O que sustenta a relação é um tempo de resposta previsível e cumprido.",
  ),
  mc(
    "Como se dá uma má notícia a um cliente?",
    [
      ["Cedo, com o facto, o impacto e o plano de correção", true],
      ["Depois de já teres resolvido, para não o preocupar", false],
      ["Na reunião mensal, junto com os bons resultados", false],
      ["Por escrito, para ficar registado e evitar discussão", false],
    ],
    "Facto, impacto, plano — e cedo. Guardar a má notícia para a acompanhar de boas notícias é o caminho mais rápido para perder credibilidade.",
  ),
  vf(
    "Um cliente irritado deve ser respondido no mesmo tom para marcar posição.",
    false,
    "O tom é sempre nosso, nunca reativo. Baixar o tom perante uma reação forte é o que mantém a conversa útil.",
  ),
  mc(
    "Quais são os canais e tempos corretos de comunicação com o cliente? (escolhe todas)",
    [
      ["Usar o canal acordado com aquele cliente", true],
      ["Confirmar por escrito o que foi decidido em chamada", true],
      ["Avisar quando um prazo vai falhar, antes de ele falhar", true],
      ["Usar o canal pessoal do consultor para agilizar", false],
    ],
    "Canal acordado, decisões por escrito, e o aviso antes do prazo — não depois.",
  ),
  mc(
    "Detetas que o cliente beneficiaria de um serviço que a WonderAds presta mas que ele não contratou. O que fazes?",
    [
      ["Passas a oportunidade ao Comercial ou ao superior in charge", true],
      ["Apresentas tu a proposta e o preço ao cliente", false],
      ["Não dizes nada — não é do teu departamento", false],
      ["Fazes o trabalho extra sem cobrar, para mostrar valor", false],
    ],
    "Todos os consultores devem saber identificar upsell; quem o conduz é o Comercial ou o superior in charge. Ver e não passar é deixar dinheiro e resultado em cima da mesa.",
  ),
  mc(
    "És do Comercial e, numa conversa, detetas uma oportunidade que sai do âmbito comercial normal. A quem a passas?",
    [
      ["Ao C-Level", true],
      ["Ao consultor da conta", false],
      ["A ninguém — segues tu, já és Comercial", false],
      ["Ao cliente, para ele decidir se quer avançar", false],
    ],
    "Consultores de SEO, WEB e ADS passam ao Comercial ou ao superior in charge; comerciais que vejam outras portas passam aos C-Level.",
  ),
  vf(
    "Detetar oportunidades é função exclusiva do departamento Comercial.",
    false,
    "É função de todos. O Comercial conduz a venda, mas quem está dentro da conta é quem vê primeiro a oportunidade.",
  ),
  mc(
    "O cliente pede algo que está fora do âmbito contratado. Qual é a melhor resposta?",
    [
      ["Explicas o que está dentro do âmbito, e encaminhas o resto para quem trata de o alargar", true],
      ["Fazes, para não criar atrito", false],
      ["Recusas, remetendo para o contrato", false],
      ["Ignoras o pedido e segues com o plano", false],
    ],
    "Nem fazer de graça nem esconder-se atrás do contrato: clarificar o âmbito e encaminhar é o que respeita o cliente e a empresa ao mesmo tempo.",
  ),
  mc(
    "Um pedido do cliente vai atrasar-se uma semana. Quando comunicas?",
    [
      ["Assim que sabes que vai atrasar", true],
      ["No dia do prazo", false],
      ["Quando tiveres a nova data confirmada ao dia", false],
      ["Só se o cliente perguntar", false],
    ],
    "Avisar cedo, mesmo sem data final fechada, dá ao cliente margem para se organizar. Avisar no dia do prazo já é dano.",
  ),
  mc(
    "O que deve estar sempre presente numa comunicação de rotina com o cliente? (escolhe todas)",
    [
      ["O que foi feito desde a última vez", true],
      ["O que vem a seguir e quando", true],
      ["O que precisas dele para avançar", true],
      ["A lista de horas gastas por tarefa", false],
    ],
    "Feito · a seguir · o que preciso de ti. Três linhas que evitam metade das perguntas do cliente.",
  ),
  vf(
    "Se o cliente não se queixa, é sinal de que está satisfeito.",
    false,
    "Silêncio não é satisfação — muitas vezes é desinteresse a caminho da saída. Quem cuida da conta procura o sinal em vez de esperar pela queixa.",
  ),
]);

// ===========================================================================
// 2a · SEO/GEO
// ===========================================================================

const SEO_M1 = build("seo-m1", [
  mc(
    "Qual é a responsabilidade central de um consultor SEO sobre a sua carteira?",
    [
      ["Garantir que cada conta tem trabalho planeado, executado e comunicado dentro do mês", true],
      ["Executar as tarefas que o roadmap gera", false],
      ["Cumprir o número de horas atribuídas a cada cliente", false],
      ["Responder aos pedidos que os clientes fazem", false],
    ],
    "A conta é tua: planear, executar e comunicar. Reagir a pedidos é o mínimo de quem não é dono da conta.",
  ),
  vf(
    "O registo de horas serve só para efeitos internos de pagamento.",
    false,
    "Serve sobretudo para saber se a conta é sustentável e onde está a fugir esforço. Sem registo honesto, uma conta a perder dinheiro só se descobre tarde de mais.",
  ),
  mc(
    "O que tem de estar sempre atualizado numa conta de SEO? (escolhe todas)",
    [
      ["O roadmap do mês em curso", true],
      ["O que já foi entregue e o que está pendente do cliente", true],
      ["As decisões tomadas em reuniões com o cliente", true],
      ["As palavras-passe pessoais do consultor", false],
    ],
    "Estado do plano, do entregue e do combinado. É isto que permite outra pessoa pegar na conta sem perder um dia.",
  ),
  mc(
    "Uma tarefa do roadmap não vai ser feita este mês. O procedimento correto é:",
    [
      ["Registar o motivo, repriorizar e comunicar o impacto ao cliente", true],
      ["Passá-la para o mês seguinte em silêncio", false],
      ["Substituí-la por outra tarefa equivalente sem registar", false],
      ["Mantê-la no plano e resolver quando houver tempo", false],
    ],
    "Um plano que muda sem registo deixa de ser plano. E um plano que muda sem o cliente saber é uma promessa quebrada em silêncio.",
  ),
  vf(
    "Reuniões-tipo (semanal interna, mensal com cliente) são opcionais quando a conta está a correr bem.",
    false,
    "A cadência é o que faz a conta correr bem. Quando se cortam reuniões porque está tudo calmo, o próximo problema é descoberto pelo cliente.",
  ),
  mc(
    "Gestão de tempo numa carteira de vários clientes significa sobretudo:",
    [
      ["Proteger blocos para trabalho de fundo, em vez de viver a reagir", true],
      ["Responder a tudo o que entra, o mais depressa possível", false],
      ["Distribuir as horas por igual entre todos os clientes", false],
      ["Concentrar o trabalho na semana do relatório", false],
    ],
    "SEO é trabalho de fundo. Uma agenda feita só de reações produz meses cheios de atividade e vazios de resultado.",
  ),
]);

const SEO_M2 = build("seo-m2", [
  mc(
    "Um cliente ainda não fez o onboarding e não há sessão de estratégia marcada. O que fazes?",
    [
      ["Ligas, explicas porque é que o dia 1 ainda não começou e fechas a marcação na chamada", true],
      ["Envias novo email com o link do onboarding", false],
      ["Começas o trabalho técnico e deixas o onboarding para depois", false],
      ["Registas como bloqueio do cliente e aguardas", false],
    ],
    "Uma chamada resolve em cinco minutos o que três emails não resolvem em duas semanas. O objetivo é sair da chamada com data marcada.",
  ),
  mc(
    "Ao ligar sobre documentos pendentes na tabela de aprovações, o que não pode faltar? (escolhe todas)",
    [
      ["Dizer exatamente o que está pendente e desde quando", true],
      ["Explicar o que fica bloqueado enquanto não for aprovado", true],
      ["Sair da chamada com um compromisso de data", true],
      ["Pedir desculpa por estar a insistir", false],
    ],
    "O que está pendente, o que isso trava e quando fica resolvido. Insistir por trabalho parado não é incomodar — é fazer o teu trabalho.",
  ),
  vf(
    "Depois de uma chamada, basta o registo mental do que foi combinado.",
    false,
    "O que não fica escrito não existe para a equipa nem para o cliente. Uma chamada fecha-se sempre com um resumo escrito do que foi acordado.",
  ),
  mc(
    "O cliente questiona resultados a meio do mês, fora da reunião mensal. A resposta correta é:",
    [
      ["Dar leitura honesta do que se sabe até àquele momento e o que ainda não é conclusivo", true],
      ["Remeter para a reunião mensal", false],
      ["Enviar já um relatório completo fora de ciclo", false],
      ["Apresentar só as métricas que estão a subir", false],
    ],
    "Estar disponível não obriga a antecipar o relatório. Obriga a ser honesto sobre o que já se sabe — e sobre o que ainda não se pode concluir.",
  ),
  mc(
    "Para que servem os roleplays de chamadas?",
    [
      ["Treinar as conversas difíceis antes de as ter com um cliente real", true],
      ["Avaliar a performance individual dos consultores", false],
      ["Criar material de marketing", false],
      ["Documentar processos para a base de conhecimento", false],
    ],
    "As conversas difíceis treinam-se onde o erro não custa a conta.",
  ),
  vf(
    "Um consultor SEO deve saber conduzir uma conversa com o cliente em qualquer momento da parceria, e não apenas nas reuniões mensais.",
    true,
    "Onboarding, meio do mês, crise, renovação — a conversa faz parte do serviço tanto como o trabalho técnico.",
  ),
  mc(
    "O cliente pede uma alteração que sabes que vai prejudicar o SEO. O que fazes?",
    [
      ["Explicas o risco com dados, propões alternativa e registas a decisão final dele", true],
      ["Executas — o cliente é que manda", false],
      ["Recusas executar", false],
      ["Executas e não registas nada, para evitar atrito", false],
    ],
    "O nosso papel é dar a melhor recomendação com evidência. A decisão pode ser do cliente — mas fica registada, para que o resultado se leia à luz dela.",
  ),
  mc(
    "Qual é o objetivo de uma chamada de cobrança de pendentes?",
    [
      ["Desbloquear o trabalho, mantendo a relação intacta", true],
      ["Deixar registado que a culpa do atraso é do cliente", false],
      ["Reduzir o âmbito do mês para compensar o atraso", false],
      ["Renegociar prazos contratuais", false],
    ],
    "O objetivo é o trabalho andar. Ter razão sobre o atraso não entrega nada a ninguém.",
  ),
]);

const SEO_M3 = build("seo-m3", [
  mc(
    "Para que serve o conjunto de ferramentas do departamento de SEO?",
    [
      ["Fundamentar decisões com dados em vez de opinião", true],
      ["Acelerar a produção de entregáveis", false],
      ["Justificar o valor do serviço perante o cliente", false],
      ["Cumprir requisitos técnicos das plataformas", false],
    ],
    "A ferramenta não substitui o critério: dá-lhe base. Uma recomendação sem dados é palpite bem apresentado.",
  ),
  vf(
    "Um output gerado por ferramenta pode ir para o cliente sem revisão do consultor.",
    false,
    "Quem assina é o consultor. Tudo o que sai leva revisão — o que a ferramenta poupa é tempo de produção, não responsabilidade.",
  ),
  mc(
    "Ao construir um roadmap, o que determina a prioridade das tarefas? (escolhe todas)",
    [
      ["O impacto esperado no objetivo do cliente", true],
      ["O que está a bloquear resultados agora", true],
      ["A dependência de terceiros (cliente, web, dev)", true],
      ["A ordem pela qual as tarefas foram identificadas", false],
    ],
    "Impacto, bloqueios e dependências. A ordem de descoberta não tem nada que ver com a ordem de execução.",
  ),
  mc(
    "Um artigo de blog produzido para um cliente deve, antes de mais:",
    [
      ["Responder à intenção de pesquisa do termo que quer trabalhar", true],
      ["Cumprir a contagem de palavras definida", false],
      ["Mencionar a marca o maior número de vezes possível", false],
      ["Ser publicado o mais depressa possível", false],
    ],
    "Volume e frequência não salvam um artigo que não responde ao que a pessoa foi procurar.",
  ),
  vf(
    "Se uma ferramenta devolve um dado estranho, deve usar-se à mesma — o dado é o dado.",
    false,
    "Dados absurdos vão para o cliente como erros teus. Verifica a fonte e cruza antes de usar.",
  ),
  mc(
    "Qual é a diferença entre fazer o trabalho e cuidar da conta?",
    [
      ["Cuidar da conta é garantir que o trabalho feito produz o resultado prometido e que o cliente o percebe", true],
      ["Cuidar da conta é responder mais depressa aos pedidos", false],
      ["Cuidar da conta é executar mais tarefas por mês", false],
      ["Não há diferença prática", false],
    ],
    "Tarefas executadas não são resultado entregue. E resultado que o cliente não percebe não conta como resultado.",
  ),
]);

const SEO_M4 = build("seo-m4", [
  mc(
    "O que tem de estar pronto ANTES da reunião de onboarding? (escolhe todas)",
    [
      ["Os acessos pedidos e, sempre que possível, já validados", true],
      ["Uma leitura inicial do negócio e do site do cliente", true],
      ["A agenda da reunião e o que se vai decidir nela", true],
      ["O roadmap completo dos 12 meses", false],
    ],
    "Acessos, leitura do negócio e agenda. O roadmap fechado antes de ouvir o cliente é um roadmap escrito às cegas.",
  ),
  mc(
    "Qual é o objetivo principal da reunião de onboarding?",
    [
      ["Perceber o negócio, alinhar objetivos e fixar o modo de trabalho conjunto", true],
      ["Explicar detalhadamente a metodologia de SEO", false],
      ["Recolher os acessos em falta", false],
      ["Apresentar a equipa da WonderAds", false],
    ],
    "Sai-se do onboarding com objetivos alinhados e regras de trabalho claras. A metodologia demonstra-se ao longo dos meses.",
  ),
  vf(
    "O dia 1 de uma parceria conta a partir da assinatura do contrato.",
    false,
    "Conta a partir do momento em que há onboarding feito e sessão de estratégia — é aí que o trabalho pode mesmo começar.",
  ),
  mc(
    "Depois da reunião de onboarding, o que é entregue ao cliente?",
    [
      ["O resumo do que foi alinhado e o plano dos primeiros passos, com datas", true],
      ["A auditoria técnica completa", false],
      ["A lista final de palavras-chave", false],
      ["O primeiro relatório mensal", false],
    ],
    "O cliente sai com alinhamento escrito e próximos passos datados — é isso que transforma uma boa reunião em confiança.",
  ),
  mc(
    "O cliente não fornece um acesso essencial. Como se trata?",
    [
      ["Explicas o que fica bloqueado, insistes por chamada e registas o bloqueio", true],
      ["Avanças com o que é possível e não voltas ao assunto", false],
      ["Suspendes o trabalho até haver acesso", false],
      ["Pedes ao cliente que execute ele essa parte", false],
    ],
    "Explicar o custo do bloqueio, insistir pelo canal que resolve e deixar registo. Bloqueios que ninguém regista transformam-se em culpa nossa três meses depois.",
  ),
  vf(
    "O pré-onboarding é dispensável quando o cliente já trabalhou com outra agência de SEO.",
    false,
    "É ainda mais importante: percebe-se o que foi feito antes, o que correu mal e que expectativas ficaram — bem ou mal — instaladas.",
  ),
  mc(
    "Um cliente novo chega com expectativas irrealistas de prazo. Quando se corrige?",
    [
      ["No onboarding, com explicação do que é razoável e porquê", true],
      ["Ao terceiro mês, se os resultados não chegarem", false],
      ["Nunca — a expectativa alta mantém o cliente motivado", false],
      ["Só se o cliente levantar o tema", false],
    ],
    "Expectativa mal calibrada no início é conta perdida no quarto mês. Corrige-se cedo, com argumento, não com promessa.",
  ),
]);

const SEO_M5 = build("seo-m5", [
  mc(
    "O relatório mensal serve sobretudo para:",
    [
      ["Ligar o trabalho feito ao resultado do negócio do cliente", true],
      ["Demonstrar o volume de tarefas executadas", false],
      ["Cumprir a obrigação contratual de reporting", false],
      ["Registar as métricas das plataformas", false],
    ],
    "Métricas sem leitura são um extrato. O relatório existe para explicar o que aconteceu ao negócio e porquê.",
  ),
  mc(
    "Como se apresenta um mês mau? (escolhe todas)",
    [
      ["Dizendo o que caiu e porquê, sem rodeios", true],
      ["Mostrando o que já está a ser feito para corrigir", true],
      ["Mantendo a comparação honesta com o período anterior", true],
      ["Destacando apenas as métricas que subiram", false],
    ],
    "Facto, causa, correção. Um mês mau bem apresentado consolida a relação; um mês mau maquilhado destrói-a quando o cliente descobre.",
  ),
  vf(
    "Se o cliente não percebe o relatório, o problema é do cliente.",
    false,
    "Um relatório que não é entendido não cumpriu a sua função. A clareza é responsabilidade de quem o faz.",
  ),
  mc(
    "Numa reunião mensal, a maior parte do tempo deve ser gasta a:",
    [
      ["Explicar a leitura dos dados e o plano do mês seguinte", true],
      ["Passar métrica a métrica do relatório", false],
      ["Recolher pedidos do cliente", false],
      ["Rever a lista de tarefas executadas", false],
    ],
    "Leitura e plano. Ler o relatório em voz alta é desperdiçar a única hora do mês em que o cliente está a olhar para nós.",
  ),
  mc(
    "Uma métrica caiu por um fator externo (sazonalidade, alteração no site do cliente). O que fazes?",
    [
      ["Mostras a queda, explicas a causa e o que muda no plano", true],
      ["Omites, porque não foi responsabilidade nossa", false],
      ["Mostras sem explicar, para não parecer desculpa", false],
      ["Compensas com outra métrica positiva", false],
    ],
    "Explicar a causa não é desculpar-se — é dar ao cliente a leitura correta. Omitir é que se paga caro na reunião seguinte.",
  ),
  vf(
    "O relatório deve ser preparado no próprio dia da reunião, para ter os dados mais recentes.",
    false,
    "Preparar em cima da hora produz erros e leituras superficiais. Os dados fecham-se com margem para haver tempo de pensar no que dizem.",
  ),
  mc(
    "Qual é o sinal de que uma reunião mensal correu bem?",
    [
      ["O cliente sabe o que aconteceu, porquê, e o que vai acontecer a seguir", true],
      ["O cliente não fez perguntas difíceis", false],
      ["Todas as métricas subiram", false],
      ["A reunião terminou antes do tempo previsto", false],
    ],
    "O critério é o entendimento do cliente, não a ausência de perguntas nem a cor dos gráficos.",
  ),
]);

// ===========================================================================
// 2b · ADS
// ===========================================================================

const ADS_M1 = build("ads-m1", [
  mc(
    "Qual é a responsabilidade central de um consultor de Ads sobre uma conta?",
    [
      ["Responder pelo resultado da verba investida e pela leitura que o cliente faz dele", true],
      ["Manter as campanhas ativas e sem erros", false],
      ["Gastar o orçamento definido dentro do mês", false],
      ["Produzir criativos com regularidade", false],
    ],
    "Estamos a gerir dinheiro de outra pessoa. Campanhas no ar sem leitura de retorno não é gestão — é manutenção.",
  ),
  vf(
    "Enquanto as campanhas estiverem a entregar, não é necessário comunicar com o cliente entre reuniões.",
    false,
    "A cadência de comunicação é parte do serviço. O cliente que só ouve falar de nós quando algo corre mal aprende a temer as nossas mensagens.",
  ),
  mc(
    "O que faz parte do trabalho de manutenção de uma conta de Ads? (escolhe todas)",
    [
      ["Acompanhar a entrega e o custo por resultado com regularidade", true],
      ["Garantir que o tracking continua a medir o que deve", true],
      ["Registar o que foi alterado e porquê", true],
      ["Alterar campanhas sempre que um dia corre pior", false],
    ],
    "Acompanhar, garantir medição e registar decisões. Reagir a um dia mau é a forma mais rápida de destruir aprendizagem.",
  ),
  mc(
    "Um cliente pede para cortar o investimento a meio do mês por causa de um dia fraco. O que fazes?",
    [
      ["Explicas o efeito do corte na aprendizagem e propões uma decisão com base na janela correta", true],
      ["Cortas — é o dinheiro dele", false],
      ["Recusas o corte", false],
      ["Cortas e não comentas", false],
    ],
    "A recomendação técnica é nossa; a decisão final é dele. Executar sem explicar o custo é omitir o que sabemos.",
  ),
  vf(
    "O registo de horas e a cadência de reuniões são menos relevantes em Ads porque a plataforma mostra tudo.",
    false,
    "A plataforma mostra números, não decisões. O que se decidiu, porquê e quando, isso só existe se for registado.",
  ),
  mc(
    "Quando é que uma conta de Ads está bem cuidada?",
    [
      ["Quando o cliente sabe quanto investe, o que recebe e o que vem a seguir", true],
      ["Quando o custo por lead é o mais baixo do mercado", false],
      ["Quando não há erros na conta", false],
      ["Quando o orçamento é integralmente gasto", false],
    ],
    "Clareza sobre investimento, retorno e próximo passo. O resto são consequências disso.",
  ),
]);

const ADS_M2 = build("ads-m2", [
  mc(
    "Qual é o objetivo da call de kick-off/onboarding em Ads?",
    [
      ["Perceber oferta, margem e objetivo de negócio antes de montar seja o que for", true],
      ["Recolher os acessos às plataformas", false],
      ["Apresentar a estrutura de campanhas proposta", false],
      ["Definir o orçamento mensal", false],
    ],
    "Sem perceber a oferta e a margem, qualquer estrutura de campanha é um palpite caro.",
  ),
  vf(
    "Sem tracking fiável, os resultados das campanhas não são interpretáveis.",
    true,
    "Sem medição correta, otimiza-se para o número errado — e o algoritmo aprende com esse erro.",
  ),
  mc(
    "Higiene de conta e prevenção de bans importa porque:",
    [
      ["Uma conta bloqueada pára a operação do cliente por tempo indeterminado", true],
      ["Reduz o custo por clique", false],
      ["Melhora a qualidade dos criativos", false],
      ["É exigido pelo contrato", false],
    ],
    "O custo de um ban não é o tempo de recuperar a conta — é a receita parada do cliente durante esse tempo.",
  ),
  mc(
    "O que pesa mais no resultado de uma campanha? (escolhe todas)",
    [
      ["A oferta", true],
      ["O criativo", true],
      ["O funil para onde o tráfego é enviado", true],
      ["O tipo de correspondência das audiências", false],
    ],
    "Oferta, criativo e funil explicam a maior parte da variação. As definições finas só importam depois destes três estarem certos.",
  ),
  vf(
    "Um criativo que funcionou noutro cliente do mesmo setor pode ser reutilizado sem adaptação.",
    false,
    "Setor igual não significa oferta, público ou posicionamento iguais. Copiar sem adaptar é a forma mais rápida de gastar orçamento a testar o que já se sabia.",
  ),
  mc(
    "A estrutura de campanha deve ser decidida com base em:",
    [
      ["Objetivo, volume de dados disponível e número de coisas que se quer testar", true],
      ["Boas práticas gerais da plataforma", false],
      ["Réplica da estrutura da conta anterior do cliente", false],
      ["Número de produtos do cliente", false],
    ],
    "Estruturas demasiado fragmentadas dispersam os dados; demasiado agregadas escondem o que está a funcionar.",
  ),
  mc(
    "O reporting de Ads ao cliente deve responder, antes de tudo, a:",
    [
      ["Quanto se investiu, quanto se obteve e o que se decidiu a partir daí", true],
      ["Quantas impressões e cliques foram gerados", false],
      ["Que criativos foram publicados", false],
      ["Que alterações foram feitas nas campanhas", false],
    ],
    "Investimento, retorno e decisão. O resto é detalhe de suporte.",
  ),
  mc(
    "Manter o cliente no loop significa:",
    [
      ["Cadência acordada, com o essencial, mesmo quando não há novidades de peso", true],
      ["Enviar relatórios sempre que há uma alteração", false],
      ["Estar disponível para responder quando ele pergunta", false],
      ["Reunir só quando os resultados justificam", false],
    ],
    "Cadência previsível. O silêncio entre reuniões é onde a confiança se perde sem ninguém dar por isso.",
  ),
]);

const ADS_M3 = build("ads-m3", [
  mc(
    "A «temperatura» do tráfego deve influenciar sobretudo:",
    [
      ["A mensagem e a oferta apresentadas em cada fase", true],
      ["O orçamento diário de cada campanha", false],
      ["O formato de anúncio escolhido", false],
      ["O tipo de objetivo de campanha", false],
    ],
    "A mesma mensagem para quem nunca ouviu falar da marca e para quem já visitou o site desperdiça as duas oportunidades.",
  ),
  vf(
    "Audiências de interesses muito estreitas são sempre melhores porque são mais relevantes.",
    false,
    "Estreitar demasiado limita a otimização e encarece a entrega. O tamanho tem de ser compatível com o volume que se quer gerar.",
  ),
  mc(
    "Antes de escalar uma campanha, o que deve estar verificado? (escolhe todas)",
    [
      ["Que o resultado é consistente e não fruto de poucos dias", true],
      ["Que o tracking está a medir corretamente", true],
      ["Que a operação do cliente aguenta o volume adicional", true],
      ["Que o criativo é o mais recente da conta", false],
    ],
    "Consistência, medição e capacidade do cliente. Escalar leads que o cliente não consegue atender queima dinheiro e reputação.",
  ),
  mc(
    "Ao testar audiências, o erro mais comum é:",
    [
      ["Tirar conclusões antes de haver dados suficientes", true],
      ["Testar demasiadas audiências ao mesmo tempo", false],
      ["Usar orçamentos iguais em todos os testes", false],
      ["Manter os mesmos criativos entre audiências", false],
    ],
    "Decidir cedo demais é como se perdem vencedores — e como se declaram vencedores que eram ruído.",
  ),
  vf(
    "Retargeting substitui a necessidade de investir em tráfego frio.",
    false,
    "Retargeting só trabalha o público que já entrou. Sem tráfego frio, a audiência esgota-se e o custo sobe.",
  ),
  mc(
    "Ao ler o dashboard de uma campanha fria, o que deve orientar a decisão?",
    [
      ["As métricas ligadas ao resultado de negócio, na janela certa", true],
      ["O CTR, por ser o indicador mais imediato", false],
      ["O custo por clique comparado com a média do setor", false],
      ["O alcance obtido no período", false],
    ],
    "Métricas intermédias explicam; não decidem. A decisão faz-se pelo custo por resultado real.",
  ),
  mc(
    "Balancear orçamentos entre conjuntos serve para:",
    [
      ["Concentrar investimento onde há resultado sem matar o que ainda está a aprender", true],
      ["Garantir que todos os conjuntos gastam o mesmo", false],
      ["Reduzir o custo médio por clique", false],
      ["Cumprir o orçamento mensal contratado", false],
    ],
    "Concentrar sem estrangular a aprendizagem — é esse o equilíbrio difícil.",
  ),
  mc(
    "Quando faz sentido usar CBO?",
    [
      ["Quando se quer que a plataforma distribua verba entre conjuntos com sinal suficiente", true],
      ["Sempre, por ser a configuração recomendada", false],
      ["Apenas em contas com orçamento elevado", false],
      ["Apenas em retargeting", false],
    ],
    "É uma ferramenta de distribuição, não um default. Sem sinal suficiente, distribui mal.",
  ),
]);

const ADS_M4 = build("ads-m4", [
  mc(
    "Em lead gen para negócios locais, o que costuma determinar o sucesso?",
    [
      ["A velocidade e a qualidade do seguimento das leads pelo cliente", true],
      ["O volume de leads gerado", false],
      ["O custo por lead", false],
      ["O número de criativos em rotação", false],
    ],
    "Leads mal seguidas transformam bom trabalho em queixa. Parte do nosso papel é garantir que o cliente está preparado para as receber.",
  ),
  vf(
    "Um custo por lead baixo é sempre sinal de campanha bem-sucedida.",
    false,
    "Leads baratas e não qualificadas custam mais caro do que leads caras que fecham. O critério é o negócio fechado, não o custo à entrada.",
  ),
  mc(
    "Formulário nativo vs funil próprio — o trade-off principal é:",
    [
      ["Volume e fricção baixa contra qualificação e controlo da experiência", true],
      ["Custo por lead contra custo por clique", false],
      ["Velocidade de implementação contra design", false],
      ["Compatibilidade com o CRM do cliente", false],
    ],
    "Nativo traz volume com pouca fricção; funil próprio filtra e prepara melhor a lead. A escolha depende da capacidade comercial do cliente.",
  ),
  mc(
    "O que deve ser acordado com o cliente antes de gerar leads? (escolhe todas)",
    [
      ["Quem responde às leads e em quanto tempo", true],
      ["Onde as leads aterram e como são registadas", true],
      ["O que conta como lead qualificada", true],
      ["O criativo que vai ser usado", false],
    ],
    "Responsável, destino e definição de qualificação. Sem isto, a discussão do terceiro mês é sobre a qualidade das leads e ninguém tem dados.",
  ),
  vf(
    "Automatizar o fluxo de leads do cliente está fora do âmbito de um consultor de Ads.",
    false,
    "Se a lead não chega depressa a quem a trata, o investimento perde-se. Garantir esse caminho faz parte de cuidar da conta.",
  ),
  mc(
    "Casos específicos de indústria (ginásios, quiropraxia) são úteis porque:",
    [
      ["Dão padrões de oferta e funil já validados, que aceleram o arranque", true],
      ["Permitem reutilizar as campanhas tal e qual", false],
      ["Garantem os mesmos resultados no mesmo setor", false],
      ["Dispensam a fase de testes", false],
    ],
    "Um padrão validado é um ponto de partida melhor — não um substituto do teste na conta concreta.",
  ),
  mc(
    "O cliente queixa-se da qualidade das leads. Qual é o primeiro passo?",
    [
      ["Verificar o que aconteceu às leads: contactadas quando, por quem, com que resposta", true],
      ["Ajustar imediatamente a segmentação", false],
      ["Reduzir o volume para melhorar a qualidade", false],
      ["Mudar o criativo", false],
    ],
    "Antes de mexer na campanha, percebe-se o que aconteceu depois do formulário. Muitas queixas de qualidade são falhas de seguimento.",
  ),
]);

const ADS_M5 = build("ads-m5", [
  mc(
    "Perceber como a plataforma funciona por dentro serve para:",
    [
      ["Antecipar o efeito das nossas decisões em vez de reagir aos resultados", true],
      ["Encontrar formas de contornar as regras", false],
      ["Justificar resultados fracos ao cliente", false],
      ["Escolher os objetivos de campanha corretos", false],
    ],
    "Quem percebe o mecanismo prevê; quem não percebe reage — e reagir tarde custa orçamento.",
  ),
  vf(
    "Convenções de nomenclatura são detalhe estético e não afetam o trabalho.",
    false,
    "Numa conta com histórico, nomes inconsistentes tornam impossível ler o que foi testado. Isso custa dinheiro em testes repetidos.",
  ),
  mc(
    "Escalar na vertical significa:",
    [
      ["Aumentar investimento no que já funciona", true],
      ["Abrir novas audiências e novos ângulos", false],
      ["Duplicar campanhas para outras geografias", false],
      ["Aumentar o número de criativos em rotação", false],
    ],
    "Vertical é mais verba no mesmo; horizontal é mais frentes. Cada uma tem o seu risco.",
  ),
  mc(
    "Automações e regras devem ser usadas com que cuidado? (escolhe todas)",
    [
      ["Saber exatamente o que disparam e quando", true],
      ["Registar que existem, para quem entrar na conta depois", true],
      ["Rever periodicamente se ainda fazem sentido", true],
      ["Aplicá-las por defeito em todas as contas", false],
    ],
    "Uma automação esquecida é uma decisão a ser tomada por ninguém, todos os dias.",
  ),
  vf(
    "O que resulta em Meta Ads transfere-se diretamente para Google Ads.",
    false,
    "Intenção e mecanismo são diferentes: no Google a procura já existe, no Meta é preciso criá-la. A estratégia muda com isso.",
  ),
  mc(
    "Ao escalar, o risco mais comum é:",
    [
      ["Aumentar depressa demais e destruir a estabilidade da entrega", true],
      ["Não ter criativos suficientes", false],
      ["Exceder o orçamento contratado", false],
      ["Perder o histórico da conta", false],
    ],
    "Escalar é um exercício de paciência. Saltos grandes reiniciam aprendizagem e costumam custar mais do que rendem.",
  ),
]);

// ===========================================================================
// 2c · WEB
// ===========================================================================

const WEB_M1 = build("web-m1", [
  mc(
    "Qual é a responsabilidade central do departamento Web numa entrega?",
    [
      ["Entregar um site que funciona, converte e pode ser mantido por outra pessoa", true],
      ["Cumprir o design aprovado pelo cliente", false],
      ["Entregar dentro do prazo previsto", false],
      ["Usar as tecnologias definidas internamente", false],
    ],
    "Funciona, converte e é mantível. Um site bonito que ninguém consegue manter é dívida entregue ao cliente.",
  ),
  vf(
    "O registo de horas em projetos Web serve apenas para faturação interna.",
    false,
    "Serve para saber quanto custa mesmo um projeto e para orçamentar o próximo com verdade. Sem registo honesto, orçamenta-se sempre a perder.",
  ),
  mc(
    "Um pedido chega diretamente ao designer, fora do fluxo de tickets. O que se faz?",
    [
      ["Regista-se no fluxo antes de executar", true],
      ["Executa-se, se for rápido", false],
      ["Recusa-se o pedido", false],
      ["Executa-se e regista-se no fim, se sobrar tempo", false],
    ],
    "Trabalho fora do fluxo não é priorizado nem visível — e depois desaparece do histórico do projeto.",
  ),
  mc(
    "O que tem de estar sempre atualizado num projeto Web? (escolhe todas)",
    [
      ["O estado real de cada tarefa", true],
      ["O que está pendente do cliente", true],
      ["As decisões de design e conteúdo aprovadas", true],
      ["As preferências pessoais do designer", false],
    ],
    "Estado, pendentes e decisões. É o que permite retomar o projeto sem depender de uma pessoa.",
  ),
  vf(
    "Trabalhar sobre um briefing incompleto é aceitável para não atrasar o arranque.",
    false,
    "Arrancar sem briefing fechado produz retrabalho — que atrasa mais do que a espera que se quis evitar.",
  ),
  mc(
    "Um projeto vai atrasar. Quando se comunica?",
    [
      ["Assim que o risco é identificado", true],
      ["Na data prevista de entrega", false],
      ["Quando houver nova data garantida", false],
      ["Só se o cliente perguntar", false],
    ],
    "Comunicar o risco cedo dá espaço para corrigir. Comunicar o facto consumado só dá espaço para desculpas.",
  ),
]);

const WEB_M2 = build("web-m2", [
  mc(
    "O que tem de estar verificado antes de um site ser entregue? (escolhe todas)",
    [
      ["Funcionamento em mobile e desktop", true],
      ["Formulários e caminhos de conversão testados de ponta a ponta", true],
      ["Conteúdo final revisto, sem textos de preenchimento", true],
      ["Aprovação do design pelo cliente, apenas", false],
    ],
    "Design aprovado é uma condição, não o critério de entrega. O critério é o site fazer o que tem de fazer.",
  ),
  vf(
    "Se o cliente aprovou o design, o site está pronto a entregar.",
    false,
    "Aprovar o aspeto não valida performance, conversão, conteúdo final nem comportamento em mobile.",
  ),
  mc(
    "Entregar um site inclui também:",
    [
      ["Deixar o cliente (ou quem o mantém) capaz de o gerir", true],
      ["Entregar os ficheiros de design", false],
      ["Publicar em produção", false],
      ["Enviar as credenciais por email", false],
    ],
    "Um site que só nós sabemos mexer não está entregue — está emprestado.",
  ),
  mc(
    "Um pedido de alteração chega já depois da entrega. Qual é o procedimento?",
    [
      ["Avaliar se está no âmbito, registar e encaminhar como novo pedido", true],
      ["Fazer, porque é rápido", false],
      ["Recusar, o projeto está fechado", false],
      ["Fazer e registar apenas se demorar mais de uma hora", false],
    ],
    "Pequenas alterações fora de âmbito, somadas, são um projeto inteiro por faturar — e ninguém dá por isso.",
  ),
  vf(
    "A velocidade e o comportamento em mobile são otimizações opcionais numa entrega.",
    false,
    "A maior parte do tráfego é móvel. Um site lento em mobile não converte, por muito bem desenhado que esteja.",
  ),
  mc(
    "Como se garante que o site entregue não se degrada com o tempo?",
    [
      ["Deixando registo do que foi feito e de como se mantém", true],
      ["Bloqueando alterações do lado do cliente", false],
      ["Entregando o ficheiro de design final", false],
      ["Fazendo backup no dia da entrega", false],
    ],
    "Documentação simples do que existe e de como se mexe evita metade dos pedidos de emergência futuros.",
  ),
]);

const WEB_M3 = build("web-m3", [
  mc(
    "Ao pedir aprovação de um design, o que deve ficar claro? (escolhe todas)",
    [
      ["O que se está a pedir para aprovar, exatamente", true],
      ["Até quando é necessária a resposta e o que atrasa se não vier", true],
      ["Como enviar feedback (onde e em que formato)", true],
      ["Quantas horas foram gastas no design", false],
    ],
    "O quê, até quando e como responder. Um pedido de aprovação vago produz feedback vago.",
  ),
  vf(
    "Feedback disperso por vários canais é aceitável desde que chegue.",
    false,
    "Feedback espalhado perde-se e gera versões contraditórias. Deve ser concentrado num sítio só, para o registo ser inequívoco.",
  ),
  mc(
    "O cliente pede uma alteração de design que prejudica a conversão. O que fazes?",
    [
      ["Explicas o efeito esperado, propões alternativa e registas a decisão", true],
      ["Executas — é o gosto dele", false],
      ["Recusas executar", false],
      ["Executas e apresentas só a tua versão na reunião seguinte", false],
    ],
    "A recomendação é nossa, a decisão é dele — mas registada, para o resultado ser lido à luz dessa escolha.",
  ),
  mc(
    "Numa call de feedback de design, o objetivo é:",
    [
      ["Sair com decisões fechadas, não com uma lista de impressões", true],
      ["Apresentar todo o trabalho feito", false],
      ["Recolher o máximo de comentários possível", false],
      ["Convencer o cliente da proposta original", false],
    ],
    "Uma call de aprovação que acaba sem decisões apenas adiou o projeto por mais uma semana.",
  ),
  vf(
    "Um ciclo de aprovação sem prazo definido é aceitável desde que o cliente esteja envolvido.",
    false,
    "Sem prazo, a aprovação escorrega indefinidamente e o projeto morre por inércia. O prazo protege as duas partes.",
  ),
  mc(
    "O cliente aprovou por escrito e depois pede para voltar atrás. O que se faz?",
    [
      ["Trata-se como alteração nova: avalia-se âmbito, esforço e impacto no prazo", true],
      ["Faz-se, porque a aprovação anterior não conta", false],
      ["Recusa-se com base na aprovação escrita", false],
      ["Faz-se sem alterar prazos, para não criar atrito", false],
    ],
    "A aprovação escrita existe exatamente para esta conversa poder ser feita com dados em vez de memória.",
  ),
]);

// ===========================================================================
// 2d · COMERCIAL
// ===========================================================================

const COM_M1 = build("com-m1", [
  mc(
    "Qual é a responsabilidade central de um comercial na WonderAds?",
    [
      ["Trazer clientes que a empresa consegue servir bem e manter", true],
      ["Fechar o maior volume de contratos possível", false],
      ["Manter o pipeline sempre cheio", false],
      ["Atingir o objetivo mensal de faturação", false],
    ],
    "Um cliente mal vendido é um problema entregue à operação — e uma saída anunciada. Vender bem é vender o que se consegue entregar.",
  ),
  vf(
    "Prometer um pouco acima do que a operação entrega é aceitável para fechar negócio.",
    false,
    "A promessa a mais paga-se toda no primeiro mês de entrega, com juros de confiança. Quem entrega passa o resto da parceria a defender uma expectativa que não criou.",
  ),
  mc(
    "O que deve ficar registado de cada interação comercial? (escolhe todas)",
    [
      ["O que o potencial cliente disse sobre o seu problema", true],
      ["O que foi prometido e em que termos", true],
      ["O próximo passo, com data", true],
      ["A impressão pessoal sobre a pessoa", false],
    ],
    "Problema, promessa e próximo passo datado. É isto que evita a operação receber um cliente com expectativas que ninguém conhece.",
  ),
  mc(
    "Uma lead não responde há duas semanas. O que se faz?",
    [
      ["Segue-se o cadenciamento definido e, se não houver resposta, fecha-se com clareza", true],
      ["Insiste-se até haver resposta", false],
      ["Remove-se do pipeline imediatamente", false],
      ["Deixa-se em aberto indefinidamente", false],
    ],
    "Pipeline com leads mortas é pipeline que mente. Fechar com clareza liberta tempo para o que está vivo.",
  ),
  vf(
    "A passagem do cliente do Comercial para a operação é um detalhe administrativo.",
    false,
    "É o momento onde mais expectativa se perde. O que foi vendido tem de chegar inteiro a quem vai entregar.",
  ),
  mc(
    "Um potencial cliente não tem o perfil certo para a WonderAds. O que fazes?",
    [
      ["Dizes com franqueza e não avanças", true],
      ["Avanças — o cliente decide se quer", false],
      ["Avanças com um preço mais alto para compensar o risco", false],
      ["Passas ao C-Level para decidirem", false],
    ],
    "Contratos que não deviam ter sido assinados custam mais do que rendem, e ocupam a equipa que devia estar noutro lado.",
  ),
]);

const COM_M2 = build("com-m2", [
  mc(
    "O que define um bom outreach?",
    [
      ["Relevância para o problema concreto de quem recebe", true],
      ["Volume de contactos enviados", false],
      ["Frequência do seguimento", false],
      ["Qualidade do texto da mensagem", false],
    ],
    "Volume sem relevância queima listas e reputação. A relevância é o que faz alguém responder.",
  ),
  vf(
    "Qualificar cedo é perder oportunidades de negócio.",
    false,
    "Qualificar cedo poupa o recurso mais caro que existe no comercial: tempo em conversas que nunca iam fechar.",
  ),
  mc(
    "O que qualifica uma lead? (escolhe todas)",
    [
      ["Ter um problema que sabemos resolver", true],
      ["Ter capacidade de investir no serviço", true],
      ["Ter quem decide envolvido na conversa", true],
      ["Ter respondido rapidamente ao primeiro contacto", false],
    ],
    "Problema, capacidade e decisor. Rapidez de resposta é simpatia, não qualificação.",
  ),
  mc(
    "Porque é que as leads têm de estar registadas e organizadas?",
    [
      ["Porque o pipeline tem de ser legível por outra pessoa que não tu", true],
      ["Para calcular comissões corretamente", false],
      ["Para cumprir requisitos de RGPD", false],
      ["Para gerar relatórios de atividade", false],
    ],
    "Um pipeline que só existe na cabeça de uma pessoa desaparece com ela — e leva o negócio junto.",
  ),
  vf(
    "Uma reunião marcada conta como sucesso, independentemente da qualificação da lead.",
    false,
    "Reuniões com leads não qualificadas enchem a agenda e esvaziam o resultado. Marcar é meio caminho apenas quando a lead faz sentido.",
  ),
  mc(
    "Qual é o objetivo do primeiro contacto?",
    [
      ["Conseguir uma conversa onde se possa perceber o problema", true],
      ["Apresentar os serviços da WonderAds", false],
      ["Enviar a proposta comercial", false],
      ["Qualificar por completo a oportunidade", false],
    ],
    "O primeiro contacto vende a conversa, não o serviço.",
  ),
]);

const COM_M3 = build("com-m3", [
  mc(
    "Qual é o erro capital mais comum numa call de vendas?",
    [
      ["Falar mais do que se ouve", true],
      ["Não apresentar o preço cedo", false],
      ["Não usar o script à letra", false],
      ["Não enviar a proposta no próprio dia", false],
    ],
    "Quem fala mais do que ouve vende o que quer vender, não o que a pessoa precisa de comprar.",
  ),
  vf(
    "Uma objeção é um sinal de que a venda está perdida.",
    false,
    "Uma objeção é interesse com dúvida por resolver. O silêncio é que costuma ser o fim.",
  ),
  mc(
    "Como se trata uma objeção de preço? (escolhe todas)",
    [
      ["Percebendo o que está mesmo por trás dela", true],
      ["Voltando ao custo do problema que a pessoa tem hoje", true],
      ["Sendo claro sobre o que está e não está incluído", true],
      ["Oferecendo desconto imediato para fechar", false],
    ],
    "Descontar antes de perceber a objeção resolve o sintoma e ensina o cliente a negociar tudo o resto.",
  ),
  mc(
    "Quando faz sentido um framework de duas calls em vez de uma?",
    [
      ["Quando a decisão exige mais informação, mais gente ou mais valor em jogo", true],
      ["Sempre, porque dá mais tempo para preparar a proposta", false],
      ["Quando a lead veio de referência", false],
      ["Quando o serviço é mais caro", false],
    ],
    "O número de calls acompanha a complexidade da decisão, não o preço da proposta.",
  ),
  vf(
    "A sub-comunicação (tom, ritmo, segurança) tem pouco peso quando os argumentos são bons.",
    false,
    "A forma como se diz determina se o argumento chega a ser ouvido. Insegurança na entrega desfaz o melhor argumento.",
  ),
  mc(
    "O que deve acontecer imediatamente após uma call de vendas?",
    [
      ["Resumo escrito com o que foi combinado e o próximo passo datado", true],
      ["Envio da proposta formal", false],
      ["Registo do resultado no pipeline, apenas", false],
      ["Contacto com o decisor que faltava", false],
    ],
    "O resumo escrito fixa a versão comum do que foi dito — e é ele que carrega o próximo passo.",
  ),
  mc(
    "Afinar a abordagem ao longo do tempo significa:",
    [
      ["Rever calls perdidas para perceber onde a conversa se desviou", true],
      ["Testar novos scripts todos os meses", false],
      ["Aumentar o volume de contactos", false],
      ["Copiar a abordagem de quem tem melhores resultados", false],
    ],
    "As calls perdidas ensinam mais do que as ganhas. Quem não as revê repete o mesmo erro durante anos.",
  ),
  vf(
    "Depois de fechado o contrato, o trabalho do comercial nessa conta termina.",
    false,
    "Termina a venda, não a responsabilidade: o que foi prometido tem de chegar intacto a quem vai entregar, e é o comercial que garante essa passagem.",
  ),
]);

/** Perguntas por id de módulo. Módulos ausentes ficam com o teste vazio. */
export const TRAINING_QUESTIONS: Record<string, TrainingQuestion[]> = {
  "comum-m1": COMUM_M1,
  "comum-m2": COMUM_M2,
  "comum-m3": COMUM_M3,
  "seo-m1": SEO_M1,
  "seo-m2": SEO_M2,
  "seo-m3": SEO_M3,
  "seo-m4": SEO_M4,
  "seo-m5": SEO_M5,
  "ads-m1": ADS_M1,
  "ads-m2": ADS_M2,
  "ads-m3": ADS_M3,
  "ads-m4": ADS_M4,
  "ads-m5": ADS_M5,
  "web-m1": WEB_M1,
  "web-m2": WEB_M2,
  "web-m3": WEB_M3,
  "com-m1": COM_M1,
  "com-m2": COM_M2,
  "com-m3": COM_M3,
};
