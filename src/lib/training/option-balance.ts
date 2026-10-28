// A resposta certa denuncia-se pelo tamanho? (v78.35)
//
// Em outubro de 2026, 74% das perguntas de escolha única tinham a certa como a
// opção mais comprida, muitas vezes duas a dez vezes maior, e a equipa
// aprendeu a escolher a mais comprida sem ler o enunciado. As opções foram
// todas reequilibradas; esta verificação é o que impede o problema de voltar.
// O CMS mostra o aviso enquanto se escreve a pergunta.
//
// A regra é deliberadamente folgada: a certa pode ser a mais comprida por uns
// caracteres, o que não pode é destacar-se.

import type { TrainingQuestion } from "@/lib/training/catalog";

const len = (s: string) => s.trim().length;
const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** O aviso a mostrar, ou null quando o tamanho não denuncia nada. */
export function lengthGiveaway(question: Pick<TrainingQuestion, "type" | "options">): string | null {
  if (question.type !== "multiple_choice" && question.type !== "multi_select") return null;
  const right = question.options.filter((o) => o.isCorrect).map((o) => len(o.text));
  const wrong = question.options.filter((o) => !o.isCorrect).map((o) => len(o.text));
  if (!right.length || !wrong.length || [...right, ...wrong].some((n) => n === 0)) return null;

  if (question.type === "multiple_choice") {
    const longestWrong = Math.max(...wrong);
    if (right[0] > longestWrong * 1.1) {
      return `A certa é a opção mais comprida (${right[0]} caracteres; a maior errada tem ${longestWrong}). Encurta-a ou dá corpo às erradas.`;
    }
    return null;
  }
  if (Math.min(...right) > Math.max(...wrong) || avg(right) > avg(wrong) * 1.2) {
    return "As certas são, de longe, as opções mais compridas. Equilibra o tamanho para não se escolherem sem ler.";
  }
  return null;
}
