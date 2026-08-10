// Frases de campeão do hub da Formação.
//
// A linha por baixo do nome não é decoração: é o tom com que a WonderAds quer
// que a equipa entre na formação. Dez frases conhecidas sobre disciplina,
// repetição e trabalho feito — não sobre "boa sorte".
//
// COM AUTOR, SEMPRE. Uma frase forte sem nome lê-se como slogan de agência;
// com o nome de quem a disse, lê-se como uma ideia que já foi provada por
// alguém. E atribuir mal é pior do que não atribuir: a frase da excelência
// como hábito é de Will Durant a resumir Aristóteles, e é assim que está
// creditada aqui, e não como toda a internet a cita.
//
// SORTEIO A CADA VISITA (v76.42). Era determinística por dia — a mesma frase
// para a mesma pessoa durante 24h. Passou a mudar sempre que se entra na
// Formação, que é o que faz alguém repará-la outra vez. A página já é
// `force-dynamic`, por isso não há cache a congelar a escolha.

export type ChampionQuote = {
  text: string;
  author: string;
};

const CHAMPION_QUOTES: ChampionQuote[] = [
  {
    text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
    author: "Robert Collier",
  },
  {
    text: "A disciplina é a ponte entre os objetivos e as conquistas.",
    author: "Jim Rohn",
  },
  {
    text: "Não contes os dias. Faz com que os dias contem.",
    author: "Muhammad Ali",
  },
  {
    text: "Somos aquilo que fazemos repetidamente. A excelência não é um ato, é um hábito.",
    author: "Will Durant",
  },
  {
    text: "O único sítio onde o sucesso vem antes do trabalho é no dicionário.",
    author: "Vince Lombardi",
  },
  {
    text: "Faz o que podes, com o que tens, onde estás.",
    author: "Theodore Roosevelt",
  },
  {
    text: "A sorte acontece quando a preparação encontra a oportunidade.",
    author: "Séneca",
  },
  {
    text: "Ou encontro um caminho, ou abro um.",
    author: "Aníbal",
  },
  {
    text: "Se queres ir depressa, vai sozinho; se queres ir longe, vai acompanhado.",
    author: "Provérbio africano",
  },
  {
    text: "Nada neste mundo substitui a persistência.",
    author: "Calvin Coolidge",
  },
];

/** Uma frase à sorte — nova a cada entrada na Formação. */
export function championQuote(): ChampionQuote {
  const i = Math.floor(Math.random() * CHAMPION_QUOTES.length);
  return CHAMPION_QUOTES[i] ?? CHAMPION_QUOTES[0];
}

/** Quantas frases há — usado nos testes e para o painel do CMS não ter de
 *  importar a lista inteira. */
export const CHAMPION_QUOTE_COUNT = CHAMPION_QUOTES.length;
