// Perguntas dos SEIS EXAMES DE FASE.
//
// NÃO SÃO QUIZZES COM MAIS PERGUNTAS. Um quiz de capítulo pergunta "o que foi
// dito na aula"; um exame pergunta "o que fazes na segunda-feira de manhã
// quando o cliente escreve isto". Por isso:
//
//  • Quase tudo é CASO, não definição. O enunciado dá uma situação concreta e
//    as opções são todas coisas que alguém já fez na vida real — a errada é
//    plausível, não absurda. Uma opção obviamente má não distingue ninguém.
//  • As distratoras são as DESCULPAS COMUNS: "a bola está do lado dele",
//    "está registado, cumpri a minha parte", "não prometi nada por escrito".
//    O exame existe para apanhar exatamente esse raciocínio.
//  • Há múltipla seleção — e, nessas, acertar em três de quatro vale ZERO.
//    É deliberado: numa decisão com cliente, esquecer um dos passos custa o
//    mesmo que não saber nenhum.
//  • A dificuldade sobe com a fase (85% → 88% → 90%), e as duas últimas quase
//    não têm perguntas de conhecimento: são de julgamento.
//
// A explicação de cada pergunta é a parte formativa — é lida na correção,
// tenha a pessoa acertado ou não, e diz o PORQUÊ, nunca só "a resposta é a B".

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

const mc =
  (prompt: string, opts: [string, boolean][], explanation: string) =>
  (id: string, order: number) =>
    q(id, prompt, opts, explanation, order);

const vf =
  (prompt: string, answer: boolean, explanation: string) =>
  (id: string, order: number) =>
    tf(id, prompt, answer, explanation, order);

function build(
  prefix: string,
  items: ((id: string, order: number) => TrainingQuestion)[],
): TrainingQuestion[] {
  return items.map((make, i) => make(`${prefix}-q${i + 1}`, i + 1));
}

// ===========================================================================
// EXAME 1 · SEMANA 1 — Fundações e padrão da casa
// ===========================================================================

const EXAME_S1 = build("exame-s1", [
  mc(
    "Um cliente pede-te, na primeira reunião, que garantas a primeira posição do Google para a keyword principal dele em três meses. Sabes que é possível — o concorrente é fraco e o site está bem. O que fazes?",
    [
      [
        "Explicas que não prometemos posições nem prazos de indexação, e comprometes-te com o trabalho e com a data da próxima leitura de dados",
        true,
      ],
      [
        "Prometes, porque neste caso concreto tens confiança técnica de que se cumpre",
        false,
      ],
      [
        "Dizes que sim verbalmente mas não deixas nada por escrito, para não criar compromisso formal",
        false,
      ],
      [
        "Encaminhas a pergunta para o C-Level e evitas responder na reunião",
        false,
      ],
    ],
    "A regra não é sobre probabilidade, é sobre controlo: a posição no Google não é nossa para prometer. E \"disse mas não escrevi\" é pior do que prometer — o cliente ouviu na mesma, e nós ficámos sem registo. Compromete-te com o que controlas: o trabalho e a data da próxima leitura.",
  ),
  mc(
    "Quais destas coisas a WonderAds recusa fazer, mesmo quando o cliente pede e pagava por elas? (escolhe todas as que se aplicam)",
    [
      ["Prometer posições concretas no Google", true],
      ["Inflacionar métricas para o relatório parecer melhor", true],
      ["Esconder ou adiar a comunicação de um mês mau", true],
      ["Recusar um cliente cuja expectativa não conseguimos servir", false],
    ],
    "As três primeiras são as linhas que não se atravessam. A quarta não é uma recusa nossa — é exatamente o contrário: preferimos recusar um cliente a servi-lo mal, e isso é uma decisão saudável, não uma falha.",
  ),
  mc(
    "Estás há cinco dias na empresa. Vês algo na conta de um cliente que te parece errado, mas não tens a certeza e não queres parecer que não sabes o básico. O que fazes?",
    [
      ["Perguntas à pessoa dona do assunto, hoje, com o contexto do que viste", true],
      ["Investigas sozinho durante a semana e só levantas a mão se confirmares", false],
      ["Registas a dúvida e esperas pela reunião semanal para a colocar", false],
      ["Assumes que quem lá esteve antes de ti já validou aquilo", false],
    ],
    "Ficar parado à espera é uma escolha — e é sempre a pior das disponíveis. Perguntar à pessoa certa à primeira poupa dias, não minutos, e ninguém foi mal avaliado por perguntar cedo. Foram-no por descobrir tarde.",
  ),
  vf(
    "Um valor da empresa que nunca te fez mudar uma decisão num dia difícil continua a ser um valor da empresa.",
    false,
    "Um valor só existe se mudar uma decisão tua quando custa. Se nunca mudou nada, é decoração de parede — e o exame do valor é sempre o dia mau, nunca o dia bom.",
  ),
  mc(
    "Cometeste um erro numa conta. O cliente ainda não deu por isso e é possível que nunca dê. Qual é a ação correta?",
    [
      ["Assumir cedo, com o efeito real e o plano de correção já ao lado", true],
      ["Corrigir em silêncio e só falar se o cliente perguntar", false],
      ["Registar internamente e avaliar no relatório mensal se vale a pena mencionar", false],
      ["Falar com o C-Level e seguir o que ele decidir, sem contactar o cliente", false],
    ],
    "Erro assumido cedo é um contratempo; erro descoberto pelo cliente é uma quebra de confiança — e a diferença entre os dois é só o tempo que demoraste a dizer. Assumir com o plano ao lado é o que faz de uma má notícia uma prova de competência.",
  ),
  mc(
    "O que significa, em comportamento concreto, \"o cliente contrata uma pessoa, não uma plataforma\"?",
    [
      [
        "O nome que o cliente associa ao serviço é o teu, e a responsabilidade pelo resultado dele também",
        true,
      ],
      ["Que as ferramentas são secundárias e não vale a pena dominá-las", false],
      ["Que o cliente deve comunicar sempre contigo e nunca com mais ninguém da casa", false],
      ["Que a relação pessoal compensa um mês de resultados fracos", false],
    ],
    "É uma frase sobre responsabilidade, não sobre exclusividade nem sobre simpatia. Significa que não há para onde empurrar: o resultado da conta tem a tua cara.",
  ),
  mc(
    "Duas contas tuas precisam de atenção esta semana. Uma é grande e está estável; a outra é pequena e está a começar a derrapar. Como decides?",
    [
      ["Pela derrapagem: o padrão não se negoceia consoante o tamanho da conta", true],
      ["Pela conta grande, porque é a que representa mais receita em risco", false],
      ["Divides o tempo por igual para nenhuma ficar sem acompanhamento", false],
      ["Escalas as duas e esperas por prioridade do responsável", false],
    ],
    "Procurar o padrão mais alto mesmo em contas pequenas é parte da definição. Uma conta que começa a derrapar é o momento em que a intervenção ainda é barata — a estável não está a pedir nada.",
  ),
  mc(
    "A dada altura percebes que o trabalho de outra pessoa da casa está a atrasar o teu cliente. Qual é a postura esperada?",
    [
      ["Sinalizas com contexto e ajudas a destravar — a responsabilidade é pelo resultado no cliente", true],
      ["Documentas que a tua parte está feita e informas o cliente de onde está o bloqueio", false],
      ["Esperas, porque insistir com um colega sobre o trabalho dele não te compete", false],
      ["Fazes tu a parte da outra pessoa sem dizer nada a ninguém", false],
    ],
    "\"Eu fiz a minha parte\" resolve a tua avaliação e não resolve o cliente. Nem apontar o dedo ao colega perante o cliente, nem fazer o trabalho dele às escondidas: sinalizar com contexto e destravar.",
  ),
  vf(
    "Antecipar um problema vale mais do que reagir bem a ele.",
    true,
    "O cliente não devia ser o primeiro a notar um problema na conta dele. Uma reação exemplar a um problema que ele descobriu primeiro já custou a confiança que a antecipação teria poupado.",
  ),
  mc(
    "Onde tem de ficar registado o que aconteceu numa conta?",
    [
      ["No Workspace — se não está lá, para a empresa não aconteceu", true],
      ["Onde for mais rápido no momento, desde que a informação exista algures", false],
      ["Em todos os sítios possíveis, para garantir que ninguém perde o contexto", false],
      ["Na conversa com o cliente, que é a fonte original da informação", false],
    ],
    "Duplicar o mesmo registo em sítios diferentes cria versões concorrentes da mesma verdade — e a certa altura ninguém sabe qual delas manda. Uma fonte, sempre a mesma.",
  ),
  mc(
    "Um cliente pede-te os acessos da conta de Google Ads dele por mensagem de telemóvel, com pressa. O que fazes?",
    [
      ["Encaminhas o pedido para o processo e o sítio certos de acessos, mesmo que isso custe algumas horas", true],
      ["Envias por mensagem, dado que o pedido veio do próprio cliente", false],
      ["Envias e apagas a mensagem a seguir", false],
      ["Envias parcialmente, só o que for menos sensível", false],
    ],
    "Acessos pedem-se e guardam-se no sítio certo, nunca em mensagens soltas — e a pressa do pedido não muda isso. Apagar a mensagem depois não desfaz o envio.",
  ),
  mc(
    "Que critério distingue \"crescer\" de \"crescer bem\", na leitura da casa?",
    [
      ["Não baixar o padrão: preferimos recusar um cliente a servir mal os que já temos", true],
      ["Aceitar todos os clientes e ajustar a equipa ao volume depois", false],
      ["Crescer sobretudo em contas grandes, que dão margem para servir melhor", false],
      ["Crescer ao ritmo do mercado, seja qual for o efeito na entrega", false],
    ],
    "O limite do crescimento é a qualidade do serviço aos clientes que já cá estão. Um cliente novo que degrada a entrega dos atuais é uma perda disfarçada de ganho.",
  ),
]);

// ===========================================================================
// EXAME 2 · SEMANA 2 — Comunicação e responsabilidade
// ===========================================================================

const EXAME_S2 = build("exame-s2", [
  mc(
    "São 18h30. Um cliente escreve uma pergunta que exige duas horas de análise para responder bem. Amanhã tens a manhã cheia. O que fazes?",
    [
      ["Respondes já a confirmar que recebeste e dizes até quando respondes a sério", true],
      ["Respondes amanhã à tarde, quando tiveres a análise feita e a resposta completa", false],
      ["Respondes já com a tua melhor estimativa, mesmo sem a análise", false],
      ["Deixas para o próximo ponto de situação agendado com o cliente", false],
    ],
    "Responder depressa vale mais do que responder completo: um \"recebi, respondo até amanhã às 16h\" fecha a ansiedade do cliente e compra-te o tempo de que precisas. O silêncio de 24 horas é que se lê como desinteresse — não a demora da análise.",
  ),
  mc(
    "O mês correu mal numa conta. A reunião mensal é depois de amanhã. Qual é a sequência correta?",
    [
      ["Dizes antes da reunião, com a leitura do porquê e o plano do mês seguinte já ao lado", true],
      ["Guardas para a reunião, onde há espaço para explicar com calma e com os dados à frente", false],
      ["Dizes na reunião mas começas pelos indicadores que subiram, para equilibrar", false],
      ["Pedes ao responsável do departamento para estar na reunião e conduzir essa parte", false],
    ],
    "Má notícia dá-se cedo, e nunca sozinha — sempre com o plano ao lado. Guardá-la para a reunião transforma-a em surpresa, e uma surpresa má custa sempre mais do que a notícia em si.",
  ),
  mc(
    "Um cliente não responde há três dias a um pedido que bloqueia o trabalho. Já enviaste dois emails. O que fazes?",
    [
      ["Ligas — mudar de canal é tua responsabilidade enquanto o trabalho estiver parado", true],
      ["Envias um terceiro email, agora com o assunto marcado como urgente", false],
      ["Registas o bloqueio como impedimento externo e passas a outra conta", false],
      ["Escalas para o C-Level contactar o cliente em teu nome", false],
    ],
    "Um pedido enviado não é um problema resolvido, e um terceiro email é o mesmo canal que já falhou duas vezes. Ligar é mais rápido do que escrever quando o assunto já ficou parado uma vez.",
  ),
  vf(
    "Sair de uma chamada com \"depois combinamos\" é aceitável quando o cliente está claramente ocupado.",
    false,
    "Sai-se de uma chamada com data marcada, não com boa vontade. \"Depois combinamos\" é o assunto a voltar para a mesma fila onde já ficou parado uma vez.",
  ),
  mc(
    "Estás a explicar a um cliente o resultado do mês. Quais destes começos estão certos? (escolhe todas as que se aplicam)",
    [
      ["Começar pelas leads e pela receita que o trabalho produziu", true],
      ["Traduzir o técnico para o negócio dele — não são impressões, são pessoas a encontrá-lo", true],
      ["Usar impressões e posições como explicação do resultado, não como título", true],
      ["Abrir com o volume de trabalho entregue no mês, para mostrar o esforço", false],
    ],
    "Números que o cliente não percebe não são impressionantes: são ruído. E o volume de trabalho entregue não é resultado — trabalho sem efeito medido é só atividade.",
  ),
  mc(
    "Um cliente escreve furioso por causa de um problema que, tecnicamente, é responsabilidade do fornecedor de alojamento dele. Como respondes?",
    [
      ["Reconheces o impacto, dizes o que já está a ser feito e ficas dono do desbloqueio até estar resolvido", true],
      ["Explicas com clareza que o problema não é nosso e indicas com quem deve falar", false],
      ["Esperas por mais informação antes de responder, para não dizer nada errado", false],
      ["Respondes só depois de o problema estar resolvido, para dar boas notícias", false],
    ],
    "Ter razão sobre de quem é a culpa não desbloqueia nada. O cliente contratou uma pessoa que resolve; ficar dono do desbloqueio não é assumir a culpa, é assumir a saída.",
  ),
  mc(
    "Detetaste, numa conta de SEO tua, que o cliente precisa claramente de um site novo. Qual é o encaminhamento correto?",
    [
      ["Sinalizas ao responsável do departamento com contexto: o que viste e porque interessa ao cliente", true],
      ["Falas diretamente com o cliente sobre o novo serviço e o valor que traria", false],
      ["Passas aos C-Level, porque é uma oportunidade de receita nova", false],
      ["Registas na conta e esperas que o Comercial detete no ciclo seguinte", false],
    ],
    "SEO, WEB e ADS passam ao responsável do departamento; só o Comercial passa aos C-Level. E quem vende não és tu — o teu trabalho é sinalizar com contexto suficiente para outra pessoa decidir.",
  ),
  mc(
    "Um colega teu está a lidar mal com um cliente e tu assististe. O que fazes?",
    [
      ["Dás-lhe o feedback em privado, descrevendo o comportamento e o efeito concreto", true],
      ["Falas com o responsável dele, para não ficar uma conversa pessoal entre pares", false],
      ["Guardas para a próxima avaliação, onde o feedback tem contexto formal", false],
      ["Deixas correr, porque a conta não é tua e não tens todo o contexto", false],
    ],
    "Feedback que não se diz não desaparece — acumula e sai pior mais tarde. Descreve-se o comportamento e o efeito, não a pessoa; corrige-se em privado; e nunca se guarda uma correção para a avaliação seguinte.",
  ),
  vf(
    "Cadência combinada e cumprida vale mais do que contacto abundante e irregular.",
    true,
    "O cliente não precisa de mais mensagens, precisa de saber quando é a próxima. Previsibilidade é o que faz uma relação parecer sob controlo.",
  ),
  mc(
    "O que é aceitável prometer a um cliente? (escolhe todas as que se aplicam)",
    [
      ["A data em que ele recebe a próxima leitura de dados", true],
      ["O trabalho concreto que vai ser feito no próximo mês", true],
      ["A data em que uma entrega tua fica pronta", true],
      ["A subida de posição de uma keyword até ao fim do trimestre", false],
    ],
    "Compromete-te com o que controlas — datas tuas e trabalho teu. O resultado do Google não é teu para prometer, por muito provável que pareça.",
  ),
  mc(
    "Numa chamada, fazes uma pergunta ao cliente e ele fica em silêncio três segundos. O que fazes?",
    [
      ["Deixas o silêncio — é ferramenta, e é onde ele responde a sério", true],
      ["Reformulas a pergunta, para não deixar o momento ficar desconfortável", false],
      ["Sugeres tu uma resposta possível, para o ajudar a arrancar", false],
      ["Mudas de assunto e voltas ao tema mais tarde", false],
    ],
    "Preencher o silêncio é responder pelo cliente. As três respostas mais úteis de uma chamada costumam vir depois de uma pausa que ninguém interrompeu.",
  ),
  mc(
    "Como se fecha corretamente uma chamada com cliente?",
    [
      ["Com o resumo do que ficou combinado, e o mesmo por escrito logo a seguir", true],
      ["Com o resumo verbal do que ficou combinado, que já é registo suficiente", false],
      ["Com o envio, nos dias seguintes, da ata formal da reunião", false],
      ["Com a marcação da chamada seguinte, que é o que garante continuidade", false],
    ],
    "O resumo verbal desaparece assim que se desliga, e uma ata dias depois já chega tarde para servir de alinhamento. Resumo no fim da chamada e por escrito a seguir, com quem faz o quê e até quando.",
  ),
]);

// ===========================================================================
// EXAME 3 · SEMANA 3 — Execução e protocolos
// ===========================================================================

const EXAME_S3 = build("exame-s3", [
  mc(
    "Estás a meio de um protocolo do departamento e percebes que o passo 2 nunca foi feito nesta conta, embora o passo 3 já esteja concluído. O que fazes?",
    [
      ["Voltas ao passo 2 e completas antes de seguir — cada passo assume que o anterior está feito", true],
      ["Segues em frente e completas o passo 2 quando houver tempo", false],
      ["Assinalas como exceção documentada e continuas, dado que o 3 já está feito", false],
      ["Refazes o passo 3 depois de fazer o 2, para garantir a ordem", false],
    ],
    "A ordem dos protocolos não é sugestão: cada passo assume que o anterior está feito E registado. Refazer trabalho já entregue por causa da ordem é o extremo oposto — o que se recupera é o passo em falta, não o que já está bom.",
  ),
  mc(
    "Trabalhaste quatro horas numa conta na segunda-feira e só te lembras de registar na quinta. O que aconteceu?",
    [
      ["O registo perdeu a utilidade para gerir carteira, mesmo estando correto no total", true],
      ["Nada de relevante, desde que o total de horas do mês esteja certo", false],
      ["Passa a ser um problema de faturação, não de gestão", false],
      ["Deixa de ser possível registá-lo e a hora perde-se", false],
    ],
    "Horas registadas fora do dia em que aconteceram deixam de servir para gerir carteira: o total continua certo e a leitura de onde o tempo está a ir passa a ser ficção. O registo é uma ferramenta de decisão, não um formulário.",
  ),
  mc(
    "O cliente pediu, a meio da semana, uma coisa que não está no roadmap e que vai comer dois dias. O que fazes primeiro?",
    [
      ["Atualizas o roadmap — é o contrato de trabalho da semana e tem de refletir a mudança", true],
      ["Fazes o pedido e atualizas o roadmap no fim, com a realidade do que aconteceu", false],
      ["Recusas por estar fora do combinado para esta semana", false],
      ["Fazes o pedido em horas extra para não mexer no que estava planeado", false],
    ],
    "Se o plano mudou, muda-se lá primeiro — senão o roadmap passa a ser um documento que descreve um mundo que já não existe. Atualizar no fim é escrever história, não gerir trabalho.",
  ),
  vf(
    "O output de uma ferramenta de SEO, quando é claro e bem fundamentado, pode substituir a decisão do consultor.",
    false,
    "O output da ferramenta é matéria-prima; a decisão continua a ser do consultor. O tempo que ganhas na ferramenta é para gastar no que ela não faz: critério e contexto do cliente.",
  ),
  mc(
    "Ao preparar o relatório, reparas que um número do GA4 não bate certo com o que esperavas. O prazo é amanhã. O que fazes?",
    [
      ["Resolves a confiança no número antes do relatório sair, mesmo que isso custe o prazo", true],
      ["Envias com o número tal como está e assinalas a dúvida em nota de rodapé", false],
      ["Omites esse indicador deste mês e explicas na reunião", false],
      ["Substituis por um indicador equivalente em que confias", false],
    ],
    "Se não confias no número, resolve-se antes do relatório, não durante. Um relatório com um número errado custa mais credibilidade do que um relatório um dia atrasado — e omitir um indicador que costuma lá estar levanta a pergunta na mesma.",
  ),
  mc(
    "Um artigo gerado com apoio de ferramenta está pronto a sair. O que tem de acontecer antes? (escolhe todas as que se aplicam)",
    [
      ["Revisão da intenção de pesquisa a que o artigo responde", true],
      ["Verificação dos factos afirmados no texto", true],
      ["Revisão do tom face ao cliente e ao público dele", true],
      ["Confirmação de que atinge o número de palavras previsto", false],
    ],
    "Artigo gerado não é artigo entregue. Intenção, factos e tom são o que a ferramenta não garante; a contagem de palavras é a métrica que não protege ninguém de publicar uma asneira bem dimensionada.",
  ),
  mc(
    "Um roadmap de cliente faz-se a partir de quê?",
    [
      ["Do negócio do cliente primeiro, e só depois das keywords", true],
      ["Do volume de pesquisa das keywords com melhor relação esforço/retorno", false],
      ["Do que os concorrentes diretos estão a trabalhar neste momento", false],
      ["Do que o cliente pediu explicitamente na última reunião", false],
    ],
    "Começar pelas keywords produz planos tecnicamente corretos que não vendem nada. O que o cliente vende, a quem, e o que para ele é uma lead boa — é isso que ordena o resto.",
  ),
  mc(
    "Escalar um bloqueio, feito bem, é:",
    [
      ["Passar o bloqueio a quem o pode desbloquear, com contexto suficiente para decidir", true],
      ["Comunicar ao superior que existe um problema e aguardar orientação", false],
      ["Registar o impedimento e informar o cliente de que está fora do teu controlo", false],
      ["Reunir todas as informações possíveis antes de envolver alguém", false],
    ],
    "Escalar não é queixar-se nem é pedir autorização: é entregar a decisão pronta a ser tomada. Sem contexto suficiente, escalar só transfere a pesquisa para quem tem menos tempo do que tu.",
  ),
  mc(
    "Duas ferramentas dão-te respostas diferentes sobre a mesma conta. O que isso normalmente significa?",
    [
      ["Que estão a responder a perguntas diferentes — e uma delas não é a pergunta que fizeste", true],
      ["Que uma das duas tem dados desatualizados e deve ser descartada", false],
      ["Que se deve usar a média das duas como estimativa", false],
      ["Que o dado não é fiável e não deve entrar no relatório", false],
    ],
    "Cada ferramenta responde a uma pergunta diferente — usar a errada dá uma resposta certa à pergunta que ninguém fez. A discrepância costuma ser informação, não erro.",
  ),
  vf(
    "Um pedido de cliente registado no sítio certo, mas sem dono nem data, está corretamente registado.",
    false,
    "Um registo sem dono e sem data é um lembrete de que alguém, algures, devia fazer alguma coisa. Cada assunto tem um dono — e uma data, senão volta a ficar parado.",
  ),
  mc(
    "O que legitima abrir uma exceção a um protocolo interno?",
    [
      ["A decisão de quem é dono do protocolo, tomada com o contexto do caso", true],
      ["A urgência do cliente, quando o prazo não permite o processo completo", false],
      ["A experiência do consultor, quando ele já fez aquilo muitas vezes", false],
      ["O facto de o resultado final ficar igual pelos dois caminhos", false],
    ],
    "Uma exceção decidida por quem é dono do protocolo é uma decisão; uma exceção decidida pela pressa é o primeiro passo para o protocolo deixar de existir. A experiência dá-te opinião sobre o protocolo — não autoridade sobre ele.",
  ),
  mc(
    "Qual destas é a leitura correta sobre o registo de horas?",
    [
      ["É uma ferramenta de gestão de carteira, e por isso o quando importa tanto como o quanto", true],
      ["É um instrumento de faturação e o que conta é o total correto", false],
      ["É um controlo de produtividade individual do consultor", false],
      ["É um requisito administrativo sem efeito na entrega ao cliente", false],
    ],
    "Se fosse só faturação, bastava o total. É para saber onde o tempo está mesmo a ir — que contas comem mais do que devem e quais estão a ser servidas a menos — e isso exige o registo no dia certo.",
  ),
]);

// ===========================================================================
// EXAME 4 · SEMANA 4 — Onboarding e primeiros 30 dias
// ===========================================================================

const EXAME_S4 = build("exame-s4", [
  mc(
    "Tens a reunião de onboarding de um cliente novo daqui a duas horas. Ainda não abriste o site dele. O que fazes?",
    [
      ["Preparas — site visto, concorrentes vistos, perguntas escritas — nem que isso custe o resto da manhã", true],
      ["Vais e usas a reunião para explorar o site com o cliente ao vivo, o que também o envolve", false],
      ["Pedes para adiar a reunião para o dia seguinte", false],
      ["Vais com o guião-padrão de onboarding, que cobre o essencial em qualquer caso", false],
    ],
    "Chega-se à reunião de onboarding com o trabalho de casa feito. Explorar o site ao vivo parece colaborativo e lê-se como \"não preparou\"; adiar por falta de preparação tua gasta a primeira impressão à mesma.",
  ),
  mc(
    "Quando é que o relógio do serviço arranca, para um cliente novo?",
    [
      ["Na sessão de estratégia — e é responsabilidade do consultor explicar isso sem soar a desculpa", true],
      ["Na data de assinatura do contrato", false],
      ["No dia em que os acessos ficam todos entregues", false],
      ["No primeiro dia do mês seguinte à assinatura", false],
    ],
    "O dia 1 é a sessão de estratégia. Isto costuma ser fonte de mal-entendidos precisamente porque, dito tarde, soa a desculpa — por isso diz-se cedo e uma vez só.",
  ),
  mc(
    "O que se pede ao cliente ANTES da reunião de onboarding? (escolhe todas as que se aplicam)",
    [
      ["Os acessos às plataformas", true],
      ["O formulário de onboarding preenchido", true],
      ["A informação sobre o que para ele é uma lead boa", true],
      ["A aprovação do roadmap dos primeiros três meses", false],
    ],
    "Acessos e formulário pedem-se antes, não durante — a reunião é para estratégia, não para logística. O roadmap é o que SAI da reunião; pedir aprovação antes seria pedir ao cliente que validasse um plano feito sem o ter ouvido.",
  ),
  mc(
    "Por onde se começa uma reunião de onboarding?",
    [
      ["Pelo negócio do cliente: o que vende, a quem, e o que é uma lead boa para ele", true],
      ["Pelo diagnóstico técnico do site, que é o ponto de partida objetivo", false],
      ["Pela apresentação da equipa e do método de trabalho da casa", false],
      ["Pelas expectativas de resultado, para alinhar logo o essencial", false],
    ],
    "Começa-se sempre pelo negócio, nunca pelo SEO. Tudo o resto — diagnóstico, método, expectativa — encaixa melhor depois de saberes o que para aquele cliente conta como ganhar.",
  ),
  vf(
    "Alinhar a expectativa de tempo (\"SEO tem curva\") deve ficar para quando o cliente perguntar porque ainda não há resultados.",
    false,
    "Alinha-se no dia 1, antes de o cliente perguntar. Dita no mês 2 em resposta a uma queixa, a mesma frase verdadeira passa a soar a desculpa — e deixa de ser acreditada.",
  ),
  mc(
    "Como fecha uma reunião de onboarding bem conduzida?",
    [
      ["Com próximos passos datados e com quem faz o quê", true],
      ["Com o compromisso de enviar a proposta de roadmap nos dias seguintes", false],
      ["Com a confirmação de que o cliente ficou confortável com o método", false],
      ["Com a marcação da primeira reunião mensal", false],
    ],
    "Próximos passos datados e com dono. As outras três são boas coisas — e nenhuma delas diz ao cliente o que acontece na segunda-feira de manhã.",
  ),
  mc(
    "Um documento teu está há oito dias na tabela de aprovações do cliente, sem resposta. Como tratas isso?",
    [
      ["Como urgência: é trabalho já pago que não está a produzir efeito", true],
      ["Como recordatório de rotina, a incluir no próximo ponto de situação", false],
      ["Como bloqueio do cliente, a registar e a mencionar no relatório mensal", false],
      ["Como sinal de que o documento não era prioritário para ele", false],
    ],
    "Aprovação pendente é trabalho já pago a não produzir efeito — e cobra-se pelo impacto para o cliente, nunca pelo incómodo para nós. Oito dias não é rotina, é dinheiro parado.",
  ),
  mc(
    "Porque é que os primeiros 30 dias pesam mais do que os 30 seguintes?",
    [
      ["Porque definem a confiança do ano inteiro da conta", true],
      ["Porque é quando se produz mais trabalho técnico", false],
      ["Porque é o período em que o cliente pode rescindir com menos custo", false],
      ["Porque é quando os resultados de SEO começam a aparecer", false],
    ],
    "É o período em que o cliente decide, sem o dizer, que tipo de fornecedor somos. Os resultados ainda nem chegaram — o que ele está a avaliar é como trabalhamos.",
  ),
  mc(
    "Recebes uma conta que vinha de outro consultor da casa, com o cliente insatisfeito com o acompanhamento anterior. Qual é a primeira coisa?",
    [
      ["Ouvir o cliente sobre o que falhou e sair dessa conversa com um compromisso datado", true],
      ["Apresentar o teu plano e o teu método, para marcar a diferença desde o início", false],
      ["Auditar tecnicamente a conta antes de qualquer conversa, para falares com dados", false],
      ["Deixar o assunto anterior para trás e recomeçar do zero sem o mencionar", false],
    ],
    "Uma conta ferida precisa primeiro de ser ouvida. Um plano apresentado antes de o cliente ter dito o que falhou lê-se como mais do mesmo — e ignorar o passado não o apaga da cabeça dele.",
  ),
  vf(
    "Se o formulário de onboarding não chegou a tempo, a reunião de estratégia deve realizar-se na mesma para não atrasar o arranque.",
    false,
    "Sem o formulário, a sessão de estratégia gasta-se a recolher o que devia estar recolhido — e conta como dia 1 na mesma. Vale mais desbloquear o formulário (ligando, se for preciso) do que queimar a sessão que arranca o serviço.",
  ),
  mc(
    "O que é entregue ao cliente DEPOIS da reunião de onboarding?",
    [
      ["O resumo do que ficou combinado e o plano de trabalho com datas", true],
      ["A gravação da reunião, para ele rever quando precisar", false],
      ["O diagnóstico técnico completo do site em documento próprio", false],
      ["A lista de acessos ainda em falta, para ele tratar quando puder", false],
    ],
    "O que fecha a reunião de onboarding é o mesmo que fecha qualquer chamada: o combinado por escrito, com datas. Os acessos em falta não se \"entregam\" ao cliente como lista para quando puder — desbloqueiam-se.",
  ),
  mc(
    "Na reunião de onboarding o cliente diz uma coisa que contradiz o que estava no formulário. O que fazes?",
    [
      ["Levantas a contradição ali e resolves qual das duas manda", true],
      ["Segues o que ele disse ao vivo, que é a informação mais recente", false],
      ["Segues o formulário, que é o registo formal", false],
      ["Registas as duas versões e clarificas mais tarde por email", false],
    ],
    "Uma contradição não resolvida na reunião vira uma decisão tomada às escuras uma semana depois. E resolvê-la ao vivo custa trinta segundos — por email custa dois dias e uma dúvida.",
  ),
]);

// ===========================================================================
// EXAME 5 · 60 DIAS — Reporting e gestão de carteira
// ===========================================================================

const EXAME_D60 = build("exame-d60", [
  mc(
    "Estás a fechar o relatório mensal de um cliente cujo mês foi objetivamente mau: leads a cair, tráfego a cair. Como o estruturas?",
    [
      ["Resultado primeiro, leitura do porquê a seguir, plano do mês seguinte ao lado", true],
      ["Trabalho realizado primeiro, para dar contexto antes do resultado", false],
      ["Indicadores que subiram primeiro, resultado depois, para não abrir em queda", false],
      ["Resultado primeiro e plano só depois de o discutires na reunião", false],
    ],
    "Um mês mau apresenta-se com o porquê e o plano já ao lado — nunca só o problema, nunca escondido atrás do esforço. Levar o resultado sem plano transforma a reunião num tribunal em vez de numa decisão.",
  ),
  mc(
    "Quando sai o relatório mensal?",
    [
      ["No início do mês seguinte, sempre — a pontualidade é metade da credibilidade do número", true],
      ["Quando os dados do mês estabilizarem, tipicamente a meio do mês seguinte", false],
      ["Na data da reunião mensal, para o cliente o receber com a explicação", false],
      ["Assim que o consultor tiver a análise concluída", false],
    ],
    "Um relatório que sai em dia variável ensina o cliente a não contar com ele. E entregá-lo só na reunião tira-lhe o tempo de o ler — o que garante perguntas superficiais.",
  ),
  mc(
    "Tens oito contas e uma semana com metade do tempo disponível. Quais destes critérios usas para decidir? (escolhe todas as que se aplicam)",
    [
      ["Contas onde há uma derrapagem a começar, enquanto a correção ainda é barata", true],
      ["Compromissos datados já assumidos com clientes esta semana", true],
      ["Aprovações pendentes que estão a segurar trabalho já pago", true],
      ["Contas com maior faturação mensal, independentemente do estado", false],
    ],
    "O tamanho da conta não é critério de atenção — se fosse, as contas pequenas degradavam-se por desenho até se tornarem problemas grandes. O que ordena é risco, compromisso assumido e trabalho parado.",
  ),
  vf(
    "Uma conta estável e sem pedidos do cliente é uma conta que não precisa de atenção esta semana.",
    false,
    "Silêncio do cliente não é sinal de saúde. Antecipar vale mais do que reagir — e a conta estável de hoje é onde a próxima surpresa se está a formar sem ninguém olhar.",
  ),
  mc(
    "Na reunião mensal, o cliente diz que não percebe o indicador que estás a mostrar. Qual é a leitura correta?",
    [
      ["O problema é da apresentação: números que o cliente não percebe são ruído, não são impressionantes", true],
      ["Vale a pena explicar a métrica em detalhe, para ele ganhar literacia para os meses seguintes", false],
      ["Deve substituir-se por uma métrica mais simples, mesmo que diga menos", false],
      ["É natural: métricas técnicas exigem tempo de habituação", false],
    ],
    "A responsabilidade da tradução é de quem apresenta. Isso não é o mesmo que simplificar até o número deixar de dizer nada — é dizer o que aquele número significa para o negócio dele.",
  ),
  mc(
    "O que tem obrigatoriamente de sair de uma reunião mensal?",
    [
      ["O cliente a saber o que vem a seguir e o que precisa de aprovar", true],
      ["O cliente a concordar com a leitura do mês que passou", false],
      ["O registo formal das métricas apresentadas", false],
      ["A validação do orçamento do mês seguinte", false],
    ],
    "O passado explica-se; o futuro é o que se decide. Uma reunião em que o cliente sai a saber o que aconteceu, mas não o que vem a seguir nem o que tem de aprovar, foi uma apresentação, não uma reunião.",
  ),
  mc(
    "Apresentaste trabalho feito no mês, mas sem efeito medido nos resultados. Como é que isso conta?",
    [
      ["Como atividade — trabalho sem efeito medido não é resultado, e diz-se assim", true],
      ["Como resultado parcial, dado que o efeito de SEO é diferido", false],
      ["Como resultado, se o trabalho estava no roadmap aprovado", false],
      ["Não se apresenta, para não dar ao cliente a ideia de esforço sem retorno", false],
    ],
    "Mostra-se o que foi feito E o que isso produziu. \"Está no roadmap\" e \"o SEO é diferido\" são verdades que não convertem atividade em resultado — e omitir o trabalho é pior ainda: o cliente pagou-o.",
  ),
  mc(
    "Um cliente pede para antecipar a reunião mensal para um dia em que o relatório ainda não está fechado. O que fazes?",
    [
      ["Reagendas para depois do relatório, explicando porquê, ou fechas o relatório antes", true],
      ["Aceitas e fazes a reunião com os dados provisórios que já tens", false],
      ["Aceitas e envias o relatório fechado depois da reunião", false],
      ["Aceitas e transformas a reunião num ponto de situação, sem dados", false],
    ],
    "Uma reunião mensal com números que ainda vão mudar produz decisões que depois se desmentem. Vale mais mover a data — ou fechar o relatório mais cedo — do que apresentar dados que não aguentam a semana.",
  ),
  vf(
    "Se o mês foi mau por causa de uma decisão que o cliente tomou contra a tua recomendação, o relatório deve dizê-lo.",
    true,
    "Deve — e diz-se sem tribunal: o que aconteceu, o efeito, e o que se propõe agora. Esconder a causa protege o cliente do desconforto e tira-lhe a informação de que precisa para decidir melhor da próxima vez.",
  ),
  mc(
    "Como se deve preparar uma reunião mensal de uma conta que corre bem há quatro meses?",
    [
      ["Com o mesmo cuidado — a rotina é onde a atenção cai primeiro", true],
      ["De forma mais leve, libertando tempo para as contas em risco", false],
      ["Com foco na renovação e no aumento de investimento", false],
      ["Reduzindo a frequência, dado que o cliente está satisfeito", false],
    ],
    "As contas que se perdem raramente se perdem em crise: perdem-se por desatenção lenta numa fase boa. E transformar a reunião de uma conta saudável numa conversa de upsell é a forma mais rápida de a tornar não-saudável.",
  ),
  mc(
    "Que indicadores encabeçam a leitura de um relatório de SEO?",
    [
      ["Leads e receita", true],
      ["Impressões e posições médias", false],
      ["Tráfego orgânico total", false],
      ["Número de conteúdos publicados", false],
    ],
    "Leads e receita primeiro; impressões, posições e tráfego são a explicação, não o título. Conteúdos publicados é volume de trabalho — não é sequer explicação.",
  ),
  mc(
    "Uma conta tua está a consumir sistematicamente o dobro das horas previstas. O que fazes?",
    [
      ["Levantas com dados: o que está a comer o tempo, e o que propões mudar", true],
      ["Absorves e compensas noutras contas com folga", false],
      ["Reduzes o âmbito do trabalho até as horas baterem certo", false],
      ["Registas e esperas pela revisão trimestral da carteira", false],
    ],
    "Compensar em silêncio esconde o problema até ele explodir em duas contas em vez de uma, e cortar âmbito sem falar é uma decisão sobre o serviço do cliente tomada sozinho. Levanta-se com dados e propõe-se.",
  ),
]);

// ===========================================================================
// EXAME 6 · 90 DIAS — Julgamento sob pressão (decide a efetividade)
// ===========================================================================

const EXAME_D90 = build("exame-d90", [
  mc(
    "Um cliente teu, satisfeito, sugere uma tática que sabes que traria ganho de curto prazo e risco de penalização a prazo. Ele insiste. O que fazes?",
    [
      ["Recusas, explicas o risco concreto em termos do negócio dele, e propões a alternativa que resolve o mesmo problema", true],
      ["Fazes, deixando o risco documentado por escrito para tua proteção", false],
      ["Fazes numa escala pequena, para limitar a exposição e testar", false],
      ["Escalas a decisão ao C-Level e executas o que for decidido", false],
    ],
    "Documentar o risco protege-te a ti e não protege o cliente; testar em pequena escala é fazê-lo à mesma. E escalar aqui é passar para cima uma decisão que já sabes tomar. O que se faz é recusar com alternativa — recusar sem alternativa é só dizer que não.",
  ),
  mc(
    "Descobres, ao fim de dois meses, um erro teu que custou resultados ao cliente. Ninguém deu por isso e a conta está a correr bem agora. O que fazes?",
    [
      ["Dizes, com o efeito quantificado e o que já mudaste para não repetir", true],
      ["Corriges, registas internamente e não trazes o assunto ao cliente", false],
      ["Dizes só se a conta voltar a ter um mês fraco e for preciso explicar", false],
      ["Falas primeiro com o C-Level e segues o que for decidido sobre comunicar ou não", false],
    ],
    "Dois meses depois é tarde e continua a ser melhor do que nunca. Guardar para \"quando for preciso explicar\" transforma um erro assumido numa desculpa oportunista — que é exatamente como o cliente a vai ouvir.",
  ),
  mc(
    "Um cliente quer cancelar. Diz que não vê resultados. Tu sabes que os resultados existem mas não foram bem comunicados. O que fazes?",
    [
      ["Pedes uma chamada, mostras o resultado na linguagem do negócio dele, e assumes a falha de comunicação", true],
      ["Envias um relatório detalhado com todas as evidências acumuladas", false],
      ["Propões um desconto ou um mês adicional para ele reconsiderar", false],
      ["Aceitas o cancelamento e pedes feedback para melhorar no futuro", false],
    ],
    "Se a falha foi de comunicação, mais documento é mais da mesma coisa que já falhou. Desconto compra tempo sem resolver a causa. Assumir a falha e mostrar o resultado na linguagem dele é a única coisa que ataca o problema real.",
  ),
  vf(
    "Perante um pedido do cliente que te parece errado mas não é grave, executar é a opção mais profissional, porque quem paga decide.",
    false,
    "Quem paga decide — depois de saber. Executar sem dizer o que achas é abdicar da única coisa que ele não pode comprar noutro sítio: o teu critério. Dizes, e se ele mantiver, executas bem.",
  ),
  mc(
    "Estás numa chamada difícil e o cliente diz algo factualmente errado sobre o trabalho feito, à frente de duas pessoas da equipa dele. O que fazes?",
    [
      ["Corriges ali, com factos e sem confronto — deixar passar seria deixar a versão errada tornar-se a oficial", true],
      ["Deixas passar e corriges por escrito depois da reunião, em privado", false],
      ["Deixas passar: contradizer um cliente à frente da equipa dele custa mais do que ganha", false],
      ["Pedes para retomar o ponto no fim da reunião, quando estiverem só os dois", false],
    ],
    "Uma versão errada dita à frente da equipa dele passa a ser a versão da casa dele. Corrige-se ali, com factos e sem ganhar a discussão — a alternativa é passar meses a trabalhar contra um mal-entendido que já ninguém liga a esta reunião.",
  ),
  mc(
    "Que critérios distinguem uma decisão que tomas sozinho de uma que escalas? (escolhe todas as que se aplicam)",
    [
      ["Escalas quando a decisão muda o compromisso comercial com o cliente", true],
      ["Escalas quando tem risco reputacional para a casa", true],
      ["Escalas quando exige uma exceção a um protocolo de que não és dono", true],
      ["Escalas quando não tens certeza absoluta do resultado técnico", false],
    ],
    "Certeza absoluta não existe em quase nada — escalar por falta dela seria não decidir nunca. Escala-se o que sai do teu perímetro: compromisso comercial, reputação da casa, e exceções a regras de outros.",
  ),
  mc(
    "O cliente pede um relatório extraordinário a meio do mês, para uma reunião interna dele. Custa-te meio dia que estava alocado a trabalho de resultado. O que fazes?",
    [
      ["Fazes uma versão enxuta que serve a reunião dele, e dizes o que ficou para trás e quando entra", true],
      ["Fazes o relatório completo — o pedido do cliente é prioridade", false],
      ["Recusas e explicas que o relatório mensal sai na data prevista", false],
      ["Fazes e absorves o tempo fora do horário, para não afetar o plano", false],
    ],
    "Servir o pedido no tamanho certo, com o custo explicitado, é a resposta adulta. O relatório completo é gastar meio dia numa reunião que não é tua; recusar ignora que a reunião dele existe; e absorver em silêncio esconde o custo até ele voltar como cansaço.",
  ),
  vf(
    "Se seguiste o protocolo e o resultado no cliente foi mau, a responsabilidade é do protocolo.",
    false,
    "O protocolo é o mínimo, não o álibi. Aqui a responsabilidade é pelo resultado no cliente — e um protocolo que produz maus resultados é informação que tens de devolver a quem é dono dele, não uma cobertura para ti.",
  ),
  mc(
    "Um colega pede-te para não reportares uma falha dele que afetou um cliente teu, dizendo que já corrigiu. O que fazes?",
    [
      ["Dizes-lhe que vais reportar o facto — sem julgamento — porque o cliente foi afetado", true],
      ["Aceitas, dado que está corrigido e reportar só criaria conflito interno", false],
      ["Aceitas, mas dizes que se repetir vais reportar as duas ocorrências", false],
      ["Reportas sem lhe dizer, para evitar a conversa desconfortável", false],
    ],
    "Aceitar torna-te parte do encobrimento; reportar às escondidas resolve o facto e parte a relação. Diz-se à pessoa e reporta-se — a conversa desconfortável é o preço de fazer as duas coisas certas.",
  ),
  mc(
    "Estás a três dias do fim do mês. Percebes que uma entrega prometida a um cliente não vai ficar pronta. O que fazes primeiro?",
    [
      ["Avisas o cliente hoje, com a nova data e o motivo — e só depois tratas de recuperar", true],
      ["Concentras tudo em tentar cumprir e avisas no último dia se falhar mesmo", false],
      ["Entregas uma versão reduzida na data para cumprir o compromisso formal", false],
      ["Avisas no dia da entrega, quando tiveres a certeza e a nova data firme", false],
    ],
    "A informação vale mais cedo do que completa: o cliente pode ter planos dependentes daquela data. Tentar em silêncio até ao último dia rouba-lhe o tempo de reagir, e uma versão reduzida entregue como se fosse a prometida é uma promessa cumprida no papel e falhada na realidade.",
  ),
  mc(
    "Depois de 90 dias, o que distingue um consultor efetivo de alguém que apenas cumpre as tarefas?",
    [
      ["Ser dono do resultado do cliente — antecipar, decidir dentro do seu perímetro e levantar a mão cedo fora dele", true],
      ["Dominar as ferramentas e os protocolos melhor do que a média", false],
      ["Manter as contas sem reclamações e as horas dentro do previsto", false],
      ["Ter a maior carteira que a equipa consegue servir", false],
    ],
    "Ferramentas, ausência de reclamações e volume são consequências possíveis — nenhuma é a coisa. O que se avalia aos 90 dias é se já se pode confiar a esta pessoa uma conta sem alguém atrás dela.",
  ),
  mc(
    "Qual destas situações exige que fales com o cliente HOJE, mesmo sem teres ainda a solução? (escolhe todas as que se aplicam)",
    [
      ["Uma entrega prometida que já sabes que vai falhar a data", true],
      ["Um erro nosso com efeito visível na conta dele", true],
      ["Uma queda de resultado que ele vai ver na plataforma antes da tua reunião", true],
      ["Uma alteração interna de processo que não muda nada para ele", false],
    ],
    "A regra é uma só: fala-se hoje sempre que o cliente possa descobrir por si antes de tu lhe dizeres. O que não muda nada para ele não é notícia — é ruído, e ruído gasta a atenção de que precisas quando a notícia for a sério.",
  ),
]);

/** Bancos de perguntas por exame. Editáveis aqui — os exames NÃO passam pelo
 *  CMS: uma régua que qualquer pessoa pode baixar deixa de ser régua. */
export const EXAM_QUESTIONS: Record<string, TrainingQuestion[]> = {
  "exame-s1": EXAME_S1,
  "exame-s2": EXAME_S2,
  "exame-s3": EXAME_S3,
  "exame-s4": EXAME_S4,
  "exame-d60": EXAME_D60,
  "exame-d90": EXAME_D90,
};
