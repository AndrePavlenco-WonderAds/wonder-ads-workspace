// Frases de campeão do hub da Formação.
//
// A linha por baixo do nome não é decoração: é o tom com que a WonderAds quer
// que a equipa entre na formação. Fala de responsabilidade sobre a conta e de
// fazer o trabalho bem feito — não de "boa sorte".
//
// A escolha é DETERMINÍSTICA (username + dia), não aleatória: dentro do mesmo
// dia a frase é sempre a mesma para a mesma pessoa, o que evita que mude a
// cada refresh, e muda no dia seguinte, o que evita que canse.

const CHAMPION_LINES = [
  "Campeões não nascem prontos. Treinam quando ninguém está a ver.",
  "A conta do cliente é tua. O resultado dele também.",
  "Ninguém se torna bom por acaso — torna-se bom por repetição.",
  "O que aprendes hoje é o que entregas ao cliente amanhã.",
  "Detalhe é o que separa quem faz de quem faz bem.",
  "Se o cliente não responde, o próximo passo continua a ser teu.",
  "Um mês mau não define um campeão. A reação a ele, sim.",
  "Sabe explicar o que fazes. É isso que transforma trabalho em confiança.",
  "Faz as perguntas difíceis cedo. Custam sempre menos do que tarde.",
  "Excelência é um hábito, não um momento de inspiração.",
];

/** Dias inteiros desde a época — muda a frase à meia-noite. */
function dayIndex(nowMs: number): number {
  return Math.floor(nowMs / 86_400_000);
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function championLine(username: string, nowMs: number): string {
  const i = (hash(username) + dayIndex(nowMs)) % CHAMPION_LINES.length;
  return CHAMPION_LINES[i];
}
