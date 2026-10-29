// Perguntas dos SEIS EXAMES DE FASE — o NÚCLEO dos exames de SEO/GEO.
//
// Só a especialização SEO/GEO tem exames, por isso este núcleo é escrito para
// consultores de SEO/GEO: clientes (clínicas e negócios locais), relatórios,
// roadmap, Search Console, GA4, Google Business Profile, conteúdo e
// visibilidade nas IAs. Não há aqui Google Ads, projetos de Web nem trabalho
// comercial. E não há registo de horas: a WonderAds não faz time tracking, por
// isso nenhuma pergunta, opção ou explicação fala em horas registadas,
// orçamentos de horas, horas extra ou faturação.
//
// NÃO SÃO QUIZZES COM MAIS PERGUNTAS. Um quiz de capítulo pergunta "o que foi
// dito na aula"; um exame pergunta "o que fazes na segunda-feira de manhã
// quando o cliente escreve isto". Por isso:
//
//  • Quase tudo é CASO, não definição. O enunciado dá uma situação concreta e
//    as opções são todas coisas que alguém já fez na vida real — a errada é
//    plausível, não absurda. Uma opção obviamente má não distingue ninguém.
//  • Há UMA resposta claramente certa (ou, na múltipla seleção, um conjunto
//    claramente certo). As erradas são as DESCULPAS e os ATALHOS comuns: "a
//    bola está do lado dele", "fiz a minha parte", "não prometi nada por
//    escrito". Uma errada NUNCA é uma boa prática dita de outra maneira — se
//    também ajudava a ser melhor consultor, a pergunta tinha duas certas.
//  • A certa não se denuncia pelo tamanho (`option-balance.ts`): fica curta,
//    as erradas carregam a desculpa e o pormenor vai para a explicação.
//  • Há múltipla seleção — e, nessas, acertar em três de quatro vale ZERO.
//    É deliberado: numa decisão com cliente, esquecer um dos passos custa o
//    mesmo que não saber nenhum.
//  • A dificuldade sobe com a fase (85% → 88% → 90%), e as duas últimas quase
//    não têm perguntas de conhecimento: são de julgamento.
//
// Cada folha sorteia 8 perguntas deste núcleo (`exam-draw.ts`), só das
// elegíveis — por isso cada exame tem de manter pelo menos 8, e de
// preferência 10 ou mais.
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

type Maker = (id: string, order: number) => TrainingQuestion;

const mc =
  (prompt: string, opts: [string, boolean][], explanation: string): Maker =>
  (id, order) =>
    q(id, prompt, opts, explanation, order);

const vf =
  (prompt: string, answer: boolean, explanation: string): Maker =>
  (id, order) =>
    tf(id, prompt, answer, explanation, order);

/** O lugar de uma pergunta RETIRADA. O id de cada pergunta é a posição dela
 *  na lista (`build`) e as tentativas guardadas apontam para esse id — por
 *  isso uma pergunta retirada deixa o lugar vazio em vez de sair da lista
 *  (senão todas as seguintes mudavam de id), e uma pergunta nova entra
 *  SEMPRE no fim, com um id nunca usado. O motivo fica escrito para quem vier
 *  depois. */
const retirada = (motivo: string) => ({ retirada: motivo });

function build(
  prefix: string,
  items: (Maker | ReturnType<typeof retirada>)[],
): TrainingQuestion[] {
  return items.flatMap((item, i) =>
    typeof item === "function" ? [item(`${prefix}-q${i + 1}`, i + 1)] : [],
  );
}

// ===========================================================================
// EXAME 1 · SEMANA 1 — Cultura, mindset e padrão da casa
// ===========================================================================

const EXAME_S1 = build("exame-s1", [
  mc(
    "Um cliente pede-te, na primeira reunião, que garantas a primeira posição do Google para a keyword principal dele em três meses. Sabes que é possível — o concorrente é fraco e o site está bem. O que fazes?",
    [
      [
        "Dizes que não prometemos posições e comprometes-te com o trabalho e com a data da próxima leitura de dados",
        true,
      ],
      [
        "Prometes, porque o concorrente é fraco, o site está bem e neste caso tens confiança técnica de que se cumpre",
        false,
      ],
      [
        "Dizes que sim verbalmente mas não deixas nada por escrito, para não criar um compromisso formal que te possam cobrar",
        false,
      ],
      [
        "Encaminhas a pergunta para o C-Level e evitas responder, para não te comprometeres logo na primeira reunião",
        false,
      ],
    ],
    'A regra não é sobre probabilidade, é sobre controlo: a posição no Google não é nossa para prometer, e o prazo de indexação também não — por muito fraco que seja o concorrente. E "disse mas não escrevi" é pior do que prometer — o cliente ouviu na mesma, e nós ficámos sem registo. Passar a pergunta ao C-Level também não ajuda: é fugir a uma resposta que já sabes dar. Compromete-te com o que controlas: o trabalho e a data da próxima leitura de dados.',
  ),
  mc(
    "Um cliente pede-te estas coisas — e até pagava mais por elas. Quais recusas? (escolhe todas as que se aplicam)",
    [
      ["Garantir por escrito o 1.º lugar no Google para a keyword principal", true],
      ["Arredondar para cima os números do relatório que ele vai mostrar aos sócios", true],
      ["Guardar o relatório de um mês mau para quando houver melhores notícias", true],
      ["Fazer um resumo de uma página do relatório para a reunião de sócios dele", false],
    ],
    "As três primeiras são linhas que não se atravessam, pague o cliente o que pagar: a posição no Google não é nossa para garantir, um número arredondado para cima é um número falso, e um mês mau comunica-se quando acontece, não quando der jeito. A quarta é um pedido legítimo: dar-lhe o mesmo relatório num formato que ele consiga usar não muda nenhum número.",
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
    "Um valor da casa que só cumpres nos dias em que não te custa nada é, ainda assim, um valor que vives.",
    false,
    "Um valor só existe se mudar uma decisão tua quando custa. No dia bom toda a gente o cumpre — o exame do valor é sempre o dia mau, e se nesse dia ele não muda nada, é decoração de parede.",
  ),
  mc(
    "Cometeste um erro numa conta. O cliente ainda não deu por isso e é possível que nunca dê. Qual é a ação correta?",
    [
      ["Assumir cedo, com o efeito real e o plano de correção já ao lado", true],
      ["Corrigir em silêncio e só falar se o cliente perguntar", false],
      ["Registar internamente e avaliar no relatório mensal se vale a pena mencionar", false],
      ["Assumir só se o efeito for grande; se for pequeno, não vale a pena alarmar", false],
    ],
    "Erro assumido cedo é um contratempo; erro descoberto pelo cliente é uma quebra de confiança — e a diferença entre os dois é só o tempo que demoraste a dizer. O tamanho do efeito não decide se se diz, decide só o tamanho do plano. Assumir com o plano ao lado é o que faz de uma má notícia uma prova de competência.",
  ),
  mc(
    "O que significa, em comportamento concreto, \"o cliente contrata uma pessoa, não uma plataforma\"?",
    [
      [
        "Que o nome associado ao serviço é o teu, e a responsabilidade pelo resultado dele também",
        true,
      ],
      ["Que as ferramentas são secundárias e não vale a pena dominá-las, já que o cliente compra a relação", false],
      ["Que o cliente deve comunicar sempre contigo e nunca com mais ninguém da casa", false],
      ["Que a relação pessoal compensa um mês de resultados fracos, se o cliente confiar em ti", false],
    ],
    "É uma frase sobre responsabilidade, não sobre exclusividade nem sobre simpatia. Significa que não há para onde empurrar: o resultado da conta tem a tua cara.",
  ),
  mc(
    "Duas contas tuas precisam de atenção esta semana. Uma é grande e está estável; a outra é pequena e começou a perder cliques há três semanas. Como decides?",
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
      ["Sinalizas com contexto e ajudas a destravar, porque respondes pelo resultado no cliente", true],
      ["Documentas que a tua parte está feita e dizes ao cliente onde está o bloqueio, para ficar claro que não é teu", false],
      ["Esperas, porque insistir com um colega sobre o trabalho dele não te compete", false],
      ["Fazes tu a parte da outra pessoa sem dizer nada, para o cliente não sentir o atraso", false],
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
    "No arranque de uma conta, o cliente manda-te pelo WhatsApp, com pressa, o utilizador e a palavra-passe do WordPress do site. O que fazes?",
    [
      ["Registas o acesso na página do cliente na app — é lá que os acessos ficam", true],
      ["Deixas na conversa, que é privada e fácil de encontrar quando precisares", false],
      ["Guardas numa nota tua no telemóvel, para teres o acesso sempre à mão", false],
      ["Reencaminhas para o grupo da equipa, para quem precisar já o ter", false],
    ],
    "Acessos de cliente guardam-se num sítio só — no fundo da página do cliente, na app — e nunca em mensagens soltas nem em notas pessoais. Uma palavra-passe deixada numa conversa é uma palavra-passe que ninguém encontra quando a conta muda de consultor, e reencaminhá-la é multiplicar o problema. A pressa do cliente não muda isso. Na Search Console, no GA4 e no Google Business Profile nem é preciso palavra-passe: pede-se ao cliente que nos adicione como utilizador.",
  ),
  retirada(
    "«Crescer vs. crescer bem»: decisão da direção sobre aceitar clientes e contratar, não do consultor de SEO/GEO (out. 2026).",
  ),
]);

// ===========================================================================
// EXAME 2 · SEMANA 2 — Comunicação e responsabilidade
// ===========================================================================

const EXAME_S2 = build("exame-s2", [
  mc(
    "São 18h30. Um cliente escreve a perguntar porque caíram os cliques esta semana — responder bem exige uma análise a fundo. Amanhã tens a manhã cheia. O que fazes?",
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
      ["Pedes ao responsável do departamento que seja ele a dar a má notícia", false],
    ],
    "Má notícia dá-se cedo, e nunca sozinha — sempre com o plano ao lado. Guardá-la para a reunião transforma-a em surpresa, e uma surpresa má custa sempre mais do que a notícia em si. E passá-la a outra pessoa tira ao cliente o consultor dele no momento em que mais precisa dele.",
  ),
  mc(
    "Um cliente não responde há três dias a um pedido que bloqueia o trabalho. Já enviaste dois emails. O que fazes?",
    [
      ["Ligas — mudar de canal é tua responsabilidade enquanto o trabalho estiver parado", true],
      ["Envias um terceiro email, agora com o assunto marcado como urgente, para ficar tudo por escrito", false],
      ["Registas o bloqueio como impedimento externo e passas a outra conta — a bola está do lado dele", false],
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
    "Estás a explicar a um cliente o resultado do mês. Quais destas abordagens estão certas? (escolhe todas as que se aplicam)",
    [
      ["Começar pelas leads e pela receita que o trabalho produziu", true],
      ["Traduzir o técnico para o negócio dele — não são impressões, são pessoas a encontrá-lo", true],
      ["Usar impressões e posições como explicação do resultado, não como título", true],
      ["Abrir com o volume de trabalho entregue, para explicar o esforço por trás do resultado", false],
    ],
    "Números que o cliente não percebe não são impressionantes: são ruído. E o volume de trabalho entregue não é resultado — trabalho sem efeito medido é só atividade.",
  ),
  mc(
    "Um cliente escreve furioso por causa de um problema que, tecnicamente, é responsabilidade do fornecedor de alojamento dele. Como respondes?",
    [
      ["Reconheces o impacto, dizes o que já está a ser feito e ficas dono do desbloqueio", true],
      ["Explicas com clareza que o problema é do alojamento e indicas-lhe com quem falar", false],
      ["Esperas por mais informação do alojamento, para não dizer nada errado", false],
      ["Respondes só depois de o problema estar resolvido, para dar boas notícias", false],
    ],
    "Ter razão sobre de quem é a culpa não desbloqueia nada. O cliente contratou uma pessoa que resolve; ficar dono do desbloqueio até estar resolvido não é assumir a culpa, é assumir a saída. E esperar por mais informação deixa um cliente furioso sem resposta, o que é pior do que uma resposta incompleta.",
  ),
  retirada(
    "Encaminhamento de um site novo (Web/Comercial): os exames são só de SEO/GEO, sem projetos de Web nem trabalho comercial (out. 2026).",
  ),
  mc(
    "Um colega teu está a lidar mal com um cliente e tu assististe. O que fazes?",
    [
      ["Dás-lhe o feedback em privado, descrevendo o comportamento e o efeito concreto", true],
      ["Falas com o responsável dele, para não ficar uma conversa pessoal entre pares", false],
      ["Guardas para a próxima avaliação dele, onde o feedback tem contexto formal e peso", false],
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
      ["Com o resumo por escrito só quando o cliente o pede, para não lhe encher o email", false],
    ],
    "O resumo verbal desaparece assim que se desliga, uma ata dias depois já chega tarde para servir de alinhamento, e esperar que o cliente peça o resumo é garantir que ninguém o tem quando surgir a dúvida. Resumo no fim da chamada e por escrito a seguir, com quem faz o quê e até quando.",
  ),
]);

// ===========================================================================
// EXAME 3 · SEMANA 3 — Execução e protocolos
// ===========================================================================

const EXAME_S3 = build("exame-s3", [
  mc(
    "Estás a meio de um protocolo do departamento e percebes que o passo 2 nunca foi feito nesta conta, embora o passo 3 já esteja concluído. O que fazes?",
    [
      ["Completas o passo 2 antes de seguir — cada passo assume que o anterior está feito", true],
      ["Segues em frente e completas o passo 2 quando houver tempo, já que o 3 não ficou bloqueado", false],
      ["Assinalas como exceção documentada e continuas, dado que o passo 3 já está feito", false],
      ["Refazes o passo 3 depois de fazer o 2, para garantir que a ordem do protocolo é cumprida", false],
    ],
    "A ordem dos protocolos não é sugestão: cada passo assume que o anterior está feito E registado. Refazer trabalho já entregue por causa da ordem é o extremo oposto — o que se recupera é o passo em falta, não o que já está bom.",
  ),
  retirada(
    "Registo de horas atrasado: a WonderAds não faz time tracking (out. 2026).",
  ),
  mc(
    "A meio da semana, o cliente pede-te uma coisa que não está no roadmap — uma página para uma campanha que vai lançar — e que vai ocupar dois dias de trabalho. O que fazes primeiro?",
    [
      ["Avalias se serve o projeto e os resultados de SEO/GEO; se servir, mudas o roadmap", true],
      ["Fazes já, porque o pedido é do cliente, e atualizas o roadmap no fim da semana com o que aconteceu", false],
      ["Recusas, porque está fora do combinado para esta semana e abrir exceções habitua mal o cliente", false],
      ["Metes logo no roadmap, no lugar do que estava previsto, porque quem decide as prioridades é o cliente", false],
    ],
    "Primeiro avalia-se: aquele pedido serve o projeto e os resultados que a consultoria de SEO/GEO tem de produzir — posições, cliques, leads, visibilidade nas IAs? Se serve, atualiza-se o roadmap antes de começar, com o que sai ou anda para trás para lhe dar lugar, à vista do cliente: o roadmap muda com o projeto e tem de descrever o que está mesmo a acontecer. Se não serve, diz-se ao cliente porquê e propõe-se a alternativa; se ele mantiver o pedido, entra no roadmap da mesma forma. Fazer primeiro e atualizar depois é escrever história; meter no roadmap sem avaliar é deixar o pedido mais recente ditar as prioridades; recusar sem avaliar é tratar o roadmap como um muro, não como um plano.",
  ),
  vf(
    "O output de uma ferramenta de SEO, quando é claro e bem fundamentado, pode substituir a decisão do consultor.",
    false,
    "O output da ferramenta é matéria-prima; a decisão continua a ser do consultor. O tempo que ganhas na ferramenta é para gastar no que ela não faz: critério e contexto do cliente.",
  ),
  mc(
    "Ao preparar o relatório, reparas que um número do GA4 não bate certo com o que esperavas. O prazo é amanhã. O que fazes?",
    [
      ["Resolves a dúvida antes de enviar e, se atrasar, avisas o cliente da nova data", true],
      ["Envias no prazo com o número como está — se estiver errado, corriges no mês seguinte", false],
      ["Omites esse indicador do relatório deste mês e explicas a ausência na reunião", false],
      ["Substituis por um indicador equivalente em que confias, para cumprir o prazo", false],
    ],
    "Se não confias no número, resolve-se antes do relatório, não durante. Um relatório com um número errado custa mais credibilidade do que um relatório um dia atrasado — desde que o cliente saiba da nova data antes de dar pela falta. Corrigir no mês seguinte é admitir o erro depois de ele já ter servido para decidir, e omitir ou trocar um indicador que costuma lá estar levanta a pergunta na mesma.",
  ),
  mc(
    "Um artigo gerado com apoio de ferramenta está pronto a sair. O que tem de acontecer antes? (escolhe todas as que se aplicam)",
    [
      ["Revisão da intenção de pesquisa a que o artigo responde", true],
      ["Verificação dos factos afirmados no texto", true],
      ["Revisão do tom face ao cliente e ao público dele", true],
      // Passou a certa na v78.34 (o André: «a respondida está mais completa»);
      // a errada passou a ser a desculpa de sempre, a nova opção 5.
      ["Confirmação de que atinge o número de palavras previsto", true],
      ["Publicação imediata para cumprir o calendário, com a revisão feita já com o artigo online", false],
    ],
    "Artigo gerado não é artigo entregue. Intenção, factos, tom e o tamanho combinado são o que a ferramenta não garante — e rever depois de publicar é deixar o cliente ver a asneira primeiro.",
  ),
  mc(
    "Um roadmap de cliente faz-se a partir de quê?",
    [
      ["Do negócio do cliente: o que vende, a quem, e o que é uma lead boa", true],
      ["Das keywords com mais volume no setor, que é onde está o tráfego a ganhar", false],
      ["Do roadmap de outra clínica da carteira que já deu resultado, mudando o nome", false],
      ["Dos pedidos que o cliente fez na reunião, pela ordem em que os disse", false],
    ],
    "Começar pelas keywords de mais volume produz planos tecnicamente corretos que não vendem nada; copiar o roadmap de outra clínica ignora o que esta vende e a quem; e seguir os pedidos pela ordem em que foram ditos é deixar a última frase da reunião ordenar o trimestre. O negócio do cliente — o que vende, a quem, e o que para ele é uma lead boa — é o que ordena o resto, keywords e quick wins incluídos.",
  ),
  mc(
    "Escalar um bloqueio, feito bem, é:",
    [
      ["Passar o bloqueio a quem o pode resolver, com contexto suficiente para decidir", true],
      ["Comunicar ao superior que existe um bloqueio e aguardar a orientação dele", false],
      ["Registar o bloqueio como impedimento e informar o cliente de que está fora do teu controlo", false],
      ["Passar o assunto a quem está acima e deixar de o acompanhar, que já não é teu", false],
    ],
    "Escalar não é queixar-se nem é pedir autorização: é entregar a decisão pronta a ser tomada. Sem contexto suficiente, escalar só transfere a pesquisa para quem tem menos tempo do que tu. E escalar não é largar: o assunto continua a ser teu até estar resolvido.",
  ),
  mc(
    "A Search Console e o Semrush dão-te números muito diferentes para o tráfego orgânico do mesmo site. O que isso normalmente significa?",
    [
      ["Que estão a medir coisas diferentes, e uma delas não responde à tua pergunta", true],
      ["Que uma das duas está desatualizada — daí a diferença — e deve ser descartada", false],
      ["Que nenhuma é exata e o mais sensato é usar a média das duas como estimativa", false],
      ["Que o dado não é fiável enquanto não baterem certo, e não entra no relatório", false],
    ],
    "A Search Console conta os cliques reais vindos do Google; o Semrush estima tráfego a partir de posições e volumes de pesquisa. Não estão a discordar — respondem a perguntas diferentes, e usar a errada dá uma resposta certa à pergunta que ninguém fez. A discrepância costuma ser informação, não erro.",
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
      ["O facto de o resultado final ficar igual pelo protocolo ou pelo atalho", false],
    ],
    "Uma exceção decidida por quem é dono do protocolo é uma decisão; uma exceção decidida pela pressa é o primeiro passo para o protocolo deixar de existir. A experiência dá-te opinião sobre o protocolo — não autoridade sobre ele.",
  ),
  retirada(
    "Leitura do registo de horas: a WonderAds não faz time tracking (out. 2026).",
  ),
]);

// ===========================================================================
// EXAME 4 · SEMANA 4 — Onboarding e primeiros 30 dias
// ===========================================================================

const EXAME_S4 = build("exame-s4", [
  retirada(
    "Reunião de onboarding sem preparação a duas horas: no protocolo SEO, Do's/Dont's/Notes, Site Audit, Keyword Research e Roadmap estão prontos 24 horas antes — o caso não tinha uma resposta limpa (out. 2026).",
  ),
  retirada(
    "«Relógio do serviço» que arranca numa «sessão de estratégia»: a regra não está nos protocolos SEO/GEO e as erradas falavam de contrato, pagamento e faturação (out. 2026).",
  ),
  mc(
    "O que se pede ao cliente ANTES da reunião de onboarding? (escolhe todas as que se aplicam)",
    [
      ["Os acessos ao site, ao GA4, à Search Console e ao Google Business Profile", true],
      ["O formulário de onboarding preenchido", true],
      ["As fotos e os materiais do negócio", true],
      ["A aprovação do roadmap, para a reunião ser só de arranque", false],
    ],
    "Acessos, formulário e fotos/materiais pedem-se antes, não durante — a reunião é para estratégia, não para logística, e sem o formulário nem o audit nem a keyword research se fazem a partir do cliente. O roadmap vai pronto para a reunião, mas revê-se e aprova-se lá, com o cliente, depois de o ouvires: não se pede aprovação a um plano que ele ainda não viu explicado.",
  ),
  mc(
    "Por onde se começa uma reunião de onboarding?",
    [
      ["Pelo negócio do cliente: o que vende, a quem, e o que é uma lead boa para ele", true],
      ["Pelo diagnóstico técnico do site, que impressiona e mostra logo serviço", false],
      ["Pela apresentação da casa e dos casos de sucesso, para ele sentir que escolheu bem", false],
      ["Pelas posições que ele pode esperar no primeiro trimestre, para o entusiasmar", false],
    ],
    "Começa-se sempre pelo negócio, nunca pelo SEO. Abrir com o diagnóstico ou com a apresentação da casa é falar de nós antes de o ouvir — e acenar com posições é a promessa que a casa não faz. O audit, o roadmap e a expectativa de tempo vêm a seguir, e encaixam melhor quando já sabes o que, para aquele cliente, conta como ganhar.",
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
      ["Com o roadmap prometido para os dias seguintes, quando tiveres tempo de o fechar", false],
      ["Com um «qualquer dúvida, diga», para o cliente sentir que estás disponível", false],
      ["Com a promessa de que os primeiros resultados se veem já no primeiro mês", false],
    ],
    "Fecha-se com próximos passos datados e com dono — é isso que diz ao cliente o que acontece na segunda-feira de manhã. «Qualquer dúvida, diga» não marca nada; o roadmap devia ter ido pronto para a reunião, não ficar prometido para depois; e prometer resultados no primeiro mês desfaz o «SEO tem curva» que acabaste de alinhar.",
  ),
  mc(
    "Um documento teu está há oito dias na tabela de aprovações do cliente, sem resposta. Como tratas isso?",
    [
      ["Como urgência: é trabalho já pago que não está a produzir efeito", true],
      ["Como recordatório de rotina, a incluir no próximo ponto de situação", false],
      ["Como bloqueio do cliente, a registar e a mencionar no relatório mensal", false],
      ["Como sinal de que o documento não era prioritário para ele", false],
    ],
    "Pelo protocolo, avisa-se o cliente quando o documento entra na tabela, manda-se o lembrete ao 3.º dia e liga-se ao 5.º — ao 8.º dia já se devia ter ligado. Aprovação pendente é trabalho já pago a não produzir efeito, e cobra-se pelo impacto para o cliente (o roadmap e os resultados atrasam), nunca pelo incómodo para nós.",
  ),
  mc(
    "Porque é que os primeiros 30 dias pesam mais do que os 30 seguintes?",
    [
      ["Porque definem a confiança do ano inteiro da conta", true],
      ["Porque é quando os resultados de SEO aparecem e o cliente julga por eles", false],
      ["Porque depois o cliente deixa de acompanhar de perto e o ritmo pode abrandar", false],
      ["Porque é quando o cliente ainda aceita atrasos, enquanto se ambienta", false],
    ],
    "É o período em que o cliente decide, sem o dizer, que tipo de fornecedor somos. Os resultados de SEO ainda nem chegaram — o que ele está a avaliar é como trabalhamos: se cumprimos datas, se respondemos, se o combinado aparece feito. Achar que o primeiro mês tolera atrasos, ou que depois dele se pode abrandar, é exatamente ao contrário.",
  ),
  mc(
    "Recebes uma conta que vinha de outro consultor da casa, com o cliente insatisfeito com o acompanhamento anterior. Qual é a primeira coisa?",
    [
      ["Ouvir o cliente sobre o que falhou e sair dessa conversa com um compromisso datado", true],
      ["Apresentar o teu plano e o teu método, para marcar a diferença desde o início", false],
      ["Auditar a conta a fundo durante semanas, antes de falares com ele, para chegares com dados", false],
      ["Deixar o assunto anterior para trás e recomeçar do zero sem o mencionar", false],
    ],
    "Uma conta ferida precisa primeiro de ser ouvida. Um plano apresentado antes de o cliente ter dito o que falhou lê-se como mais do mesmo, deixá-lo semanas sem notícias enquanto auditas confirma-lhe a queixa, e ignorar o passado não o apaga da cabeça dele.",
  ),
  vf(
    "Se o formulário de onboarding não chegou a tempo, a reunião de onboarding deve realizar-se na mesma, para não atrasar o arranque.",
    false,
    "Sem o formulário não há audit nem keyword research feitos a partir do cliente — e a reunião gasta-se a recolher o que devia estar recolhido. Vale mais desbloquear o formulário (ligando, se for preciso) do que queimar a primeira reunião com o cliente.",
  ),
  mc(
    "O que é entregue ao cliente DEPOIS da reunião de onboarding?",
    [
      ["O resumo do que ficou combinado, com quem faz o quê e até quando", true],
      ["Nada — o combinado ficou dito na reunião e o Fathom gravou tudo", false],
      ["Um relatório de posições da primeira semana, para mostrar logo trabalho", false],
      ["A lista de acessos ainda em falta, para ele tratar quando puder", false],
    ],
    "O que fecha a reunião de onboarding é o mesmo que fecha qualquer chamada: o combinado por escrito, com dono e data. A gravação não substitui o resumo — ninguém a revê para saber o que tem de fazer na segunda-feira. Um relatório de posições na primeira semana é mostrar atividade antes de haver efeito. E os acessos em falta não se \"entregam\" ao cliente como lista para quando puder — desbloqueiam-se.",
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
      ["No início do mês seguinte, sempre — a pontualidade é metade da credibilidade", true],
      ["Quando os dados do mês estabilizarem, tipicamente a meio do mês seguinte, para não ter de corrigir", false],
      ["Na data da reunião mensal, para o cliente o receber com a explicação", false],
      ["Assim que o consultor tiver a análise concluída, sem data fixa", false],
    ],
    "Um relatório que sai em dia variável ensina o cliente a não contar com ele. E entregá-lo só na reunião tira-lhe o tempo de o ler — o que garante perguntas superficiais.",
  ),
  mc(
    "Tens oito contas e uma semana com metade do tempo disponível. Quais destes critérios usas para decidir? (escolhe todas as que se aplicam)",
    [
      ["Contas onde há uma derrapagem a começar, enquanto a correção ainda é barata", true],
      ["Compromissos datados já assumidos com clientes esta semana", true],
      ["Aprovações pendentes que estão a segurar trabalho já pago", true],
      ["As contas maiores, independentemente do estado em que estão", false],
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
      ["O problema é da apresentação: um número que o cliente não entende é ruído, não impressiona", true],
      ["Vale a pena explicar a métrica em detalhe, para ele ganhar literacia para os meses seguintes", false],
      ["Deve substituir-se por uma métrica mais simples, mesmo que diga menos", false],
      ["É natural: métricas técnicas exigem tempo de habituação, e daqui a uns meses ele já as percebe", false],
    ],
    "A responsabilidade da tradução é de quem apresenta. Isso não é o mesmo que simplificar até o número deixar de dizer nada — é dizer o que aquele número significa para o negócio dele.",
  ),
  mc(
    "O que tem obrigatoriamente de sair de uma reunião mensal?",
    [
      ["O cliente a saber o que vem a seguir e o que precisa de aprovar", true],
      ["O cliente a concordar com a leitura do mês, mesmo que o próximo fique por decidir", false],
      ["Uma boa impressão do mês, que é o que segura a relação até à próxima", false],
      ["Todos os números do relatório mostrados, para nada ficar por apresentar", false],
    ],
    "O passado explica-se; o futuro é o que se decide. Uma reunião em que o cliente sai a saber o que aconteceu, mas não o que vem a seguir nem o que tem de aprovar, foi uma apresentação, não uma reunião. Mostrar todos os números não é o objetivo, e uma boa impressão sem próximos passos dura até à semana seguinte.",
  ),
  mc(
    "Apresentaste trabalho feito no mês, mas sem efeito medido nos resultados. Como é que isso conta?",
    [
      ["Como atividade, não como resultado — e é assim que se apresenta ao cliente", true],
      ["Como resultado parcial, dado que o efeito do SEO é diferido e aparece nos meses seguintes", false],
      ["Como resultado, se o trabalho estava no roadmap aprovado", false],
      ["Não se apresenta, para não dar ao cliente a ideia de esforço sem retorno", false],
    ],
    "Mostra-se o que foi feito E o que isso produziu. \"Está no roadmap\" e \"o SEO é diferido\" são verdades que não convertem atividade em resultado — e omitir o trabalho é pior ainda: o cliente pagou-o.",
  ),
  mc(
    "Um cliente pede para antecipar a reunião mensal para um dia em que o relatório ainda não está fechado. O que fazes?",
    [
      ["Reagendas para depois do relatório, explicando porquê, ou fechas o relatório antes", true],
      ["Aceitas e fazes a reunião com os dados provisórios que já tens, porque foi o dia que ele pediu", false],
      ["Aceitas e envias o relatório fechado depois da reunião, para ele ficar com os números finais", false],
      ["Aceitas e transformas a reunião num ponto de situação sem dados, para não dizer que não", false],
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
      ["Mais à pressa, porque um cliente contente não lê o relatório a fundo", false],
      ["Repetindo a leitura do mês anterior, já que os números continuam a subir", false],
      ["Reduzindo a frequência das reuniões, dado que o cliente está satisfeito", false],
    ],
    "As contas que se perdem raramente se perdem em crise: perdem-se por desatenção lenta numa fase boa. Preparar à pressa porque «ele não lê», ou repetir a leitura do mês anterior porque os números sobem, é exatamente essa desatenção — e reduzir as reuniões fura a cadência combinada no onboarding (relatório mensal e pelo menos uma chamada por mês).",
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
  retirada(
    "Conta a consumir o dobro das horas previstas: a WonderAds não faz time tracking nem orçamento de horas por conta (out. 2026).",
  ),
]);

// ===========================================================================
// EXAME 6 · 90 DIAS — Julgamento sob pressão (decide a efetividade)
// ===========================================================================

const EXAME_D90 = build("exame-d90", [
  mc(
    "Um cliente teu, satisfeito, quer comprar um pacote de backlinks baratos que viu num anúncio. Sabes que dá um salto rápido e arrisca uma penalização do Google. Ele insiste. O que fazes?",
    [
      ["Recusas, explicas o risco para o negócio dele e propões uma alternativa para o mesmo problema", true],
      ["Fazes, porque o cliente decide sobre o site dele, e deixas o risco documentado por escrito", false],
      ["Fazes numa escala pequena, para testar o ganho e limitar a exposição se o Google reagir", false],
      ["Fazes, porque ele está contente e contrariá-lo agora pode pôr a conta em risco", false],
    ],
    'Documentar o risco protege-te a ti e não protege o cliente — e "o site é dele" não muda o facto de seres tu a executar a tática. Testar em pequena escala é fazê-lo à mesma. E ceder para não contrariar um cliente satisfeito é trocar o site dele pela tua tranquilidade. O que se faz é recusar com alternativa: explicar o risco concreto em termos do negócio dele e propor o que resolve o mesmo problema. Recusar sem alternativa é só dizer que não.',
  ),
  mc(
    "Descobres, ao fim de dois meses, que um noindex que deixaste esquecido tirou do Google uma página de serviço do cliente. Ninguém deu por isso e a conta está a correr bem agora. O que fazes?",
    [
      ["Dizes, com o efeito quantificado e o que já mudaste para não repetir", true],
      ["Corriges, registas internamente e não trazes o assunto ao cliente", false],
      ["Dizes só se a conta voltar a ter um mês fraco e for preciso explicar", false],
      ["Dizes que houve um ajuste técnico, sem entrar no efeito, para não alarmar", false],
    ],
    "Dois meses depois é tarde e continua a ser melhor do que nunca. Guardar para \"quando for preciso explicar\" transforma um erro assumido numa desculpa oportunista — que é exatamente como o cliente a vai ouvir. E chamar-lhe \"ajuste técnico\" é dizer sem dizer: o cliente fica sem saber o que perdeu.",
  ),
  mc(
    "Um cliente quer cancelar. Diz que não vê resultados. Tu sabes que os resultados existem mas não foram bem comunicados. O que fazes?",
    [
      ["Pedes uma chamada, mostras o ganho na linguagem do negócio dele e assumes a falha de comunicação", true],
      ["Envias um relatório detalhado com todas as evidências de resultado acumuladas, para ele ver que existem", false],
      ["Respondes que o SEO tem curva e que ainda é cedo para julgar os resultados", false],
      ["Aceitas o cancelamento e pedes feedback para melhorar a comunicação com os próximos clientes", false],
    ],
    "Se a falha foi de comunicação, mais documento é mais da mesma coisa que já falhou, e \"o SEO tem curva\" é uma desculpa quando os resultados já lá estão. Aceitar sem mais deixa o cliente ir embora por um problema que é nosso. Assumir a falha e mostrar o resultado na linguagem dele é a única coisa que ataca o problema real.",
  ),
  vf(
    "Perante um pedido do cliente que te parece errado mas não é grave, executar é a opção mais profissional, porque quem paga decide.",
    false,
    "Quem paga decide — depois de saber. Executar sem dizer o que achas é abdicar da única coisa que ele não pode comprar noutro sítio: o teu critério. Dizes, e se ele mantiver, executas bem.",
  ),
  mc(
    "Numa chamada com o cliente e duas pessoas da equipa dele, ele diz que a queda de tráfego do mês veio de uma alteração vossa. Não veio: foi a migração do site que a equipa dele fez sem redirects. O que fazes?",
    [
      ["Corriges ali, com os dados e sem acusar ninguém, antes que a versão dele fique", true],
      ["Deixas passar e explicas-lhe depois, só a ele, para não o expor à frente da equipa", false],
      ["Deixas passar: contradizer um cliente à frente da equipa dele custa mais do que ganha", false],
      ["Corriges ali e dizes quem da equipa dele fez a migração, para ficar claro de quem foi", false],
    ],
    "A versão dita à frente da equipa dele passa a ser a versão da casa dele — e é a equipa que vai agir com base nela (pedir-vos que desfaçam uma alteração que não causou nada, por exemplo). Explicar depois, só a ele, não chega a quem ouviu. Corrige-se ali, com os dados e sem tribunal: o objetivo é a leitura certa da queda, não encontrar um culpado na equipa dele.",
  ),
  mc(
    "Que critérios distinguem uma decisão que tomas sozinho de uma que escalas? (escolhe todas as que se aplicam)",
    [
      ["Escalas quando a decisão muda o que está contratado com o cliente", true],
      ["Escalas quando tem risco reputacional para a casa", true],
      ["Escalas quando exige uma exceção a um protocolo de que não és dono", true],
      ["Escalas quando não tens certeza absoluta do resultado técnico", false],
    ],
    "Certeza absoluta não existe em quase nada — escalar por falta dela seria não decidir nunca. Escala-se o que sai do teu perímetro: o que está contratado com o cliente, a reputação da casa, e exceções a regras de outros.",
  ),
  mc(
    "O cliente pede um relatório extraordinário a meio do mês, para uma reunião interna dele. Fazê-lo tira meio dia ao trabalho do roadmap desta semana. O que fazes?",
    [
      ["Fazes uma versão enxuta para a reunião dele e dizes o que ficou para trás e quando entra", true],
      ["Fazes o relatório completo, com tudo o que vai no mensal, porque o pedido do cliente é prioridade", false],
      ["Recusas e explicas que o relatório mensal sai na data prevista, para proteger o trabalho de resultado", false],
      ["Fazes e não dizes nada sobre o que ficou para trás, para não parecer que te queixas", false],
    ],
    "Servir o pedido no tamanho certo, com o custo explicitado, é a resposta adulta. O relatório completo é gastar meio dia numa reunião que não é tua; recusar ignora que a reunião dele existe; e calar o que ficou para trás deixa o cliente sem saber que o roadmap mexeu — até dar pela falta.",
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
      ["Aceitas, dado que já está corrigido e reportar agora só criaria conflito interno sem ganho", false],
      ["Aceitas desta vez, mas avisas que, se se repetir, vais reportar as duas ocorrências", false],
      ["Reportas sem lhe dizer, para evitar a conversa desconfortável", false],
    ],
    "Aceitar torna-te parte do encobrimento; reportar às escondidas resolve o facto e parte a relação. Diz-se à pessoa e reporta-se — a conversa desconfortável é o preço de fazer as duas coisas certas.",
  ),
  mc(
    "Estás a três dias do fim do mês. Percebes que uma entrega prometida a um cliente não vai ficar pronta. O que fazes primeiro?",
    [
      ["Avisas o cliente hoje, com a nova data e o motivo — e só depois tratas de recuperar", true],
      ["Concentras tudo em tentar cumprir e avisas no último dia se falhar, para não alarmar", false],
      ["Entregas uma versão reduzida na data para cumprir o compromisso formal", false],
      ["Avisas no dia da entrega, quando tiveres a certeza e a nova data firme", false],
    ],
    "A informação vale mais cedo do que completa: o cliente pode ter planos dependentes daquela data. Tentar em silêncio até ao último dia rouba-lhe o tempo de reagir, e uma versão reduzida entregue como se fosse a prometida é uma promessa cumprida no papel e falhada na realidade.",
  ),
  mc(
    "Depois de 90 dias, o que distingue um consultor efetivo de alguém que apenas cumpre as tarefas?",
    [
      ["Ser dono do resultado: decidir no seu perímetro e levantar a mão cedo fora dele", true],
      ["Cumprir os protocolos à risca — se o resultado falhar, a parte dele está feita", false],
      ["Dizer sempre que sim ao cliente, para a conta nunca ter uma reclamação", false],
      ["Resolver tudo sozinho, sem incomodar ninguém, mesmo quando o assunto já não é dele", false],
    ],
    "Ser dono do resultado é antecipar, decidir dentro do próprio perímetro e levantar a mão cedo quando o assunto sai dele. Cumprir os protocolos é o mínimo, não o álibi; dizer sempre que sim compra silêncio, não resultado; e resolver sozinho o que já não é teu é decidir fora do perímetro. O que se avalia aos 90 dias é se já se pode confiar a esta pessoa uma conta sem alguém atrás dela.",
  ),
  mc(
    "Qual destas situações exige que fales com o cliente HOJE, mesmo sem teres ainda a solução? (escolhe todas as que se aplicam)",
    [
      ["Uma entrega prometida que já sabes que vai falhar a data", true],
      ["Um erro nosso com efeito visível na conta dele", true],
      ["Uma queda de cliques que ele vai ver na Search Console antes da tua reunião", true],
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
