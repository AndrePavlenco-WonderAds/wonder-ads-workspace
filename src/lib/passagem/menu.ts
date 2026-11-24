// O item «A minha passagem» / «Projetos a receber» do menu do nome (v80.39).
// Só existe enquanto há uma passagem ATIVA em que a pessoa sai ou recebe.
// Uma leitura (o índice), partilhada no pedido com o sino.

import "server-only";
import { getPassagemIndex } from "./store";
import { dayOf, formatISODate, totalDaysOf } from "./shared";

export type PassagemMenuView = { label: string; hint: string };

export async function passagemMenuView(username: string, todayISO: string): Promise<PassagemMenuView | null> {
  const index = (await getPassagemIndex()).filter((e) => e.status === "ativa");
  const mine = index.find((e) => e.outgoing === username);
  if (mine) {
    const day = dayOf(mine, todayISO);
    const total = totalDaysOf(mine);
    return {
      label: "A minha passagem",
      hint:
        day <= 0
          ? `Começa a ${formatISODate(mine.startDate)}`
          : day > total
            ? "Prazo terminado — fecha as fichas"
            : `Dia ${day} de ${total} · até ${formatISODate(mine.endDate)}`,
    };
  }
  const receiving = index.filter((e) => e.incoming.includes(username));
  if (receiving.length > 0) {
    return { label: "Projetos a receber", hint: "Lê as fichas, pergunta e assume" };
  }
  return null;
}
