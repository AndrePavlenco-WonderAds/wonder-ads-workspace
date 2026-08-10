// Frases de campeão do hub da Formação.
//
// A linha por baixo do nome não é decoração: é o tom com que a WonderAds quer
// que a equipa entre na formação. Dez frases conhecidas sobre disciplina,
// repetição e trabalho feito — não sobre "boa sorte".
//
// SEM AUTOR. A linha é o tom com que se entra na Formação, não uma citação a
// estudar — o nome por baixo puxava o olho para quem a disse em vez de para o
// que ela diz, e acrescentava uma segunda linha a um sítio que só tem espaço
// para uma.
//
// SORTEIO A CADA VISITA (v76.42). Era determinística por dia — a mesma frase
// para a mesma pessoa durante 24h. Passou a mudar sempre que se entra na
// Formação, que é o que faz alguém repará-la outra vez. A página já é
// `force-dynamic`, por isso não há cache a congelar a escolha.

const CHAMPION_QUOTES: string[] = [
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "A disciplina é a ponte entre os objetivos e as conquistas.",
  "Não contes os dias. Faz com que os dias contem.",
  "Somos aquilo que fazemos repetidamente. A excelência não é um ato, é um hábito.",
  "O único sítio onde o sucesso vem antes do trabalho é no dicionário.",
  "Faz o que podes, com o que tens, onde estás.",
  "A sorte acontece quando a preparação encontra a oportunidade.",
  "Ou encontro um caminho, ou abro um.",
  "Se queres ir depressa, vai sozinho; se queres ir longe, vai acompanhado.",
  "Nada neste mundo substitui a persistência.",
];

/** Uma frase à sorte — nova a cada entrada na Formação. */
export function championQuote(): string {
  const i = Math.floor(Math.random() * CHAMPION_QUOTES.length);
  return CHAMPION_QUOTES[i] ?? CHAMPION_QUOTES[0];
}

/** Quantas frases há — usado nos testes e para o painel do CMS não ter de
 *  importar a lista inteira. */
export const CHAMPION_QUOTE_COUNT = CHAMPION_QUOTES.length;
