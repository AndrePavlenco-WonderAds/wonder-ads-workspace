// Perguntas do núcleo dos exames RETIRADAS na v78.54 (registo de horas, fora
// do SEO/GEO, ou sem uma única resposta certa). NÃO entram em nenhum sorteio:
// ficam só para a ficha da direção continuar a mostrar o enunciado ao lado das
// respostas das tentativas antigas que as tiveram. Gerado a partir do
// exam-questions.ts anterior — não editar.

import type { TrainingQuestion } from "@/lib/training/catalog";

export const RETIRED_EXAM_QUESTIONS: TrainingQuestion[] = [
  {
    "id": "exame-s1-q12",
    "prompt": "Que critério distingue \"crescer\" de \"crescer bem\", na leitura da casa?",
    "type": "multiple_choice",
    "order": 12,
    "points": 1,
    "options": [
      {
        "id": "exame-s1-q12-o1",
        "text": "Não baixar o padrão: preferimos recusar um cliente a servir mal os que já temos",
        "isCorrect": true
      },
      {
        "id": "exame-s1-q12-o2",
        "text": "Aceitar todos os clientes que chegam e ajustar a equipa ao volume depois, contratando à medida",
        "isCorrect": false
      },
      {
        "id": "exame-s1-q12-o3",
        "text": "Crescer sobretudo em contas grandes, que dão margem para servir melhor",
        "isCorrect": false
      },
      {
        "id": "exame-s1-q12-o4",
        "text": "Crescer ao ritmo do mercado, para não ficar para trás das outras agências",
        "isCorrect": false
      }
    ],
    "explanation": "O limite do crescimento é a qualidade do serviço aos clientes que já cá estão. Um cliente novo que degrada a entrega dos atuais é uma perda disfarçada de ganho."
  },
  {
    "id": "exame-s2-q7",
    "prompt": "Detetaste, numa conta de SEO tua, que o cliente precisa claramente de um site novo. Qual é o encaminhamento correto?",
    "type": "multiple_choice",
    "order": 7,
    "points": 1,
    "options": [
      {
        "id": "exame-s2-q7-o1",
        "text": "Sinalizas ao responsável do departamento, com o que viste e porque interessa ao cliente",
        "isCorrect": true
      },
      {
        "id": "exame-s2-q7-o2",
        "text": "Falas diretamente com o cliente sobre o novo serviço e o valor que traria, já que és tu quem conhece a conta",
        "isCorrect": false
      },
      {
        "id": "exame-s2-q7-o3",
        "text": "Passas aos C-Level, porque é uma oportunidade de receita nova",
        "isCorrect": false
      },
      {
        "id": "exame-s2-q7-o4",
        "text": "Registas a oportunidade na conta e esperas que o Comercial a detete no ciclo seguinte",
        "isCorrect": false
      }
    ],
    "explanation": "SEO, WEB e ADS passam ao responsável do departamento; só o Comercial passa aos C-Level. E quem vende não és tu — o teu trabalho é sinalizar com contexto suficiente para outra pessoa decidir."
  },
  {
    "id": "exame-s3-q2",
    "prompt": "Trabalhaste quatro horas numa conta na segunda-feira e só te lembras de registar na quinta. O que aconteceu?",
    "type": "multiple_choice",
    "order": 2,
    "points": 1,
    "options": [
      {
        "id": "exame-s3-q2-o1",
        "text": "O registo perdeu a utilidade para gerir carteira, mesmo estando correto no total",
        "isCorrect": true
      },
      {
        "id": "exame-s3-q2-o2",
        "text": "Nada de relevante, desde que o total de horas do mês esteja certo quando o mês fechar",
        "isCorrect": false
      },
      {
        "id": "exame-s3-q2-o3",
        "text": "Passa a ser um problema de faturação, não de gestão, porque o que se fatura é o total do mês",
        "isCorrect": false
      },
      {
        "id": "exame-s3-q2-o4",
        "text": "Deixa de ser possível registá-lo e a hora perde-se",
        "isCorrect": false
      }
    ],
    "explanation": "Horas registadas fora do dia em que aconteceram deixam de servir para gerir carteira: o total continua certo e a leitura de onde o tempo está a ir passa a ser ficção. O registo é uma ferramenta de decisão, não um formulário."
  },
  {
    "id": "exame-s3-q12",
    "prompt": "Qual destas é a leitura correta sobre o registo de horas?",
    "type": "multiple_choice",
    "order": 12,
    "points": 1,
    "options": [
      {
        "id": "exame-s3-q12-o1",
        "text": "É uma ferramenta de gestão de carteira: o quando importa tanto como o quanto",
        "isCorrect": true
      },
      {
        "id": "exame-s3-q12-o2",
        "text": "É um instrumento de faturação, e por isso o que conta é o total de horas estar certo no fim do mês",
        "isCorrect": false
      },
      {
        "id": "exame-s3-q12-o3",
        "text": "É um controlo de produtividade, para avaliar quanto cada consultor entrega",
        "isCorrect": false
      },
      {
        "id": "exame-s3-q12-o4",
        "text": "É um requisito administrativo sem efeito na entrega ao cliente",
        "isCorrect": false
      }
    ],
    "explanation": "Se fosse só faturação, bastava o total. É para saber onde o tempo está mesmo a ir — que contas comem mais do que devem e quais estão a ser servidas a menos — e isso exige o registo no dia certo."
  },
  {
    "id": "exame-s4-q1",
    "prompt": "Tens a reunião de onboarding de um cliente novo daqui a duas horas. Ainda não abriste o site dele. O que fazes?",
    "type": "multiple_choice",
    "order": 1,
    "points": 1,
    "options": [
      {
        "id": "exame-s4-q1-o1",
        "text": "Preparas — site, concorrentes e perguntas escritas — nem que custe o resto da manhã",
        "isCorrect": true
      },
      {
        "id": "exame-s4-q1-o2",
        "text": "Vais e usas a reunião para explorar o site com o cliente ao vivo, o que também o envolve",
        "isCorrect": false
      },
      {
        "id": "exame-s4-q1-o3",
        "text": "Pedes para adiar a reunião para o dia seguinte, para chegares com tudo visto",
        "isCorrect": false
      },
      {
        "id": "exame-s4-q1-o4",
        "text": "Vais com o guião-padrão de onboarding, que cobre o essencial em qualquer caso e evita improvisos",
        "isCorrect": false
      }
    ],
    "explanation": "Chega-se à reunião de onboarding com o trabalho de casa feito. Explorar o site ao vivo parece colaborativo e lê-se como \"não preparou\"; adiar por falta de preparação tua gasta a primeira impressão à mesma."
  },
  {
    "id": "exame-s4-q2",
    "prompt": "Quando é que o relógio do serviço arranca, para um cliente novo?",
    "type": "multiple_choice",
    "order": 2,
    "points": 1,
    "options": [
      {
        "id": "exame-s4-q2-o1",
        "text": "Na sessão de estratégia — e cabe ao consultor dizê-lo ao cliente cedo, uma vez só",
        "isCorrect": true
      },
      {
        "id": "exame-s4-q2-o2",
        "text": "Na data de assinatura do contrato, porque é a partir daí que o cliente paga",
        "isCorrect": false
      },
      {
        "id": "exame-s4-q2-o3",
        "text": "No dia em que os acessos ficam todos entregues e se pode começar a trabalhar",
        "isCorrect": false
      },
      {
        "id": "exame-s4-q2-o4",
        "text": "No primeiro dia do mês seguinte à assinatura, para alinhar com a faturação",
        "isCorrect": false
      }
    ],
    "explanation": "O dia 1 é a sessão de estratégia. Isto costuma ser fonte de mal-entendidos precisamente porque, dito tarde, soa a desculpa — por isso diz-se cedo e uma vez só."
  },
  {
    "id": "exame-d60-q12",
    "prompt": "Uma conta tua está a consumir sistematicamente o dobro das horas previstas. O que fazes?",
    "type": "multiple_choice",
    "order": 12,
    "points": 1,
    "options": [
      {
        "id": "exame-d60-q12-o1",
        "text": "Levantas com dados: o que está a comer o tempo, e o que propões mudar",
        "isCorrect": true
      },
      {
        "id": "exame-d60-q12-o2",
        "text": "Absorves e compensas noutras contas com folga, sem alarmar ninguém",
        "isCorrect": false
      },
      {
        "id": "exame-d60-q12-o3",
        "text": "Reduzes o âmbito do trabalho até as horas baterem certo",
        "isCorrect": false
      },
      {
        "id": "exame-d60-q12-o4",
        "text": "Registas tudo e esperas pela revisão trimestral da carteira",
        "isCorrect": false
      }
    ],
    "explanation": "Compensar em silêncio esconde o problema até ele explodir em duas contas em vez de uma, e cortar âmbito sem falar é uma decisão sobre o serviço do cliente tomada sozinho. Levanta-se com dados e propõe-se."
  }
];
