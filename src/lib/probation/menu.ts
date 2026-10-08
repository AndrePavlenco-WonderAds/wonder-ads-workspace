// O item «O meu probation» do menu do nome (v77.81) — TEMPORÁRIO: existe
// enquanto o probation do consultor está a correr e desaparece sozinho.
//
// Tudo é decidido a partir do que lhe foi ENVIADO (o publicado), nunca do
// rascunho da direção — tal como a página /probation. Assim o item:
//   • aparece com o primeiro envio (o plano), não quando a direção começa a
//     escrever um rascunho;
//   • continua lá enquanto não houver uma avaliação que FECHE o probation
//     (recuperação ou saída) — uma extensão não fecha nada;
//   • quando essa avaliação chega, fica até o consultor confirmar que a leu,
//     para ele a ver pelo menu e não só pelo sino;
//   • por segurança, sai 30 dias depois do fim do último período enviado, para
//     um plano esquecido sem decisão não ficar no menu para sempre.
//
// Puro (sem KV) — o UserChip passa-lhe o publicado já lido.

import { pendingAcks, type PublishedPlan } from "./published";
import { addDaysISO, formatISODate, periodDates } from "./shared";

export type ProbationMenuView = {
  /** O andamento, numa linha: «Dia 12 de 30 · avaliação a 22/10/2026». */
  hint: string;
  /** Envios por confirmar (plano, check-ins, avaliações) — o contador. */
  unread: number;
};

const STALE_AFTER_DAYS = 30;

function daysBetween(fromISO: string, toISO: string): number {
  const [a, b] = [fromISO, toISO].map((x) => {
    const [y, m, d] = x.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

/** O que o menu mostra para um plano, ou null se o probation já acabou. */
function viewFor(pub: PublishedPlan, today: string): ProbationMenuView | null {
  const period = pub.periods.at(-1);
  if (!period || !period.startDate) return null;
  const { d15, d30 } = periodDates({ startDate: period.startDate });

  const closing = period.evals.find((e) => e.view.decision !== "extensao");
  if (closing?.ack) return null;
  if (!closing && d30 && today > addDaysISO(d30, STALE_AFTER_DAYS)) return null;

  const unread = pendingAcks(pub).length;
  if (closing) {
    return { hint: "Avaliação final disponível — abre para ler", unread };
  }

  const day = daysBetween(period.startDate, today);
  if (day < 0) {
    return { hint: `Começa a ${formatISODate(period.startDate)}`, unread };
  }
  const has15 = period.evals.some((e) => e.view.which === 15);
  const has30 = period.evals.some((e) => e.view.which === 30);
  const next = has30 ? null : has15 ? d30 : d15;
  const dayLabel = `Dia ${Math.min(day, 30)} de 30`;
  // A data já passou e a avaliação ainda não chegou ao consultor — não se
  // lhe mostra uma data no passado como se fosse a próxima.
  const tail = !next
    ? "a aguardar o novo período"
    : next < today
      ? "a aguardar a avaliação"
      : `avaliação a ${formatISODate(next)}`;
  return { hint: `${dayLabel} · ${tail}`, unread };
}

/** O item do menu para quem tem um probation a correr, ou null (sem item).
 *  Com mais do que um plano aberto, mostra o enviado mais recentemente. */
export function probationMenuView(
  pubs: PublishedPlan[],
  today: string,
): ProbationMenuView | null {
  const open = pubs
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((p) => viewFor(p, today))
    .filter((v): v is ProbationMenuView => v !== null);
  return open[0] ?? null;
}
