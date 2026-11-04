// Excesso de notificações (v78.70) — as regras, partilhadas entre o servidor
// (que decide o nível) e o cliente (que mostra o aviso).
//
// Um sino com 12 coisas por resolver deixa de ser lembrete e passa a ser
// papel de parede. Por isso, para os consultores de SEO:
//
//  • 7 ou mais por resolver → AVISO. Um pop-up no meio do ecrã diz que aos
//    10 a app entra em excesso. Aparece uma vez por dia e de novo sempre que
//    o número sobe (7, 8, 9 — «faltam 3, 2, 1»).
//  • 10 ou mais → EXCESSO. O pop-up volta em CADA página nova que a pessoa
//    abre. Não bloqueia: ao fim de uns segundos dá para continuar, mas na
//    página seguinte está lá outra vez.
//  • O excesso só acaba ABAIXO DE 5. Entre 5 e 9, quem entrou em excesso
//    continua em excesso: sem esta folga, resolver uma notificação aos 10
//    calava o aviso aos 9 e o sino voltava a encher no dia seguinte.
//
// O nível anterior vive no servidor (`overload-store.ts`), não no browser:
// a folga tem de valer no portátil e no telemóvel ao mesmo tempo, e o
// Superadmin vê no painel de equipa quem está em excesso.

export const OVERLOAD_WARN_AT = 7;
export const OVERLOAD_EXCESS_AT = 10;
/** O excesso acaba quando o número fica ABAIXO disto. */
export const OVERLOAD_CLEAR_BELOW = 5;

export type OverloadLevel = "ok" | "warn" | "excess";

export type OverloadState = {
  level: OverloadLevel;
  /** Notificações por resolver no sino da pessoa, na última página aberta. */
  count: number;
  /** Quando entrou no nível atual (ms). null em «ok». */
  since: number | null;
};

/** O nível novo a partir do número em aberto e do nível em que a pessoa
 *  estava. A folga entre 5 e 9 só existe para quem JÁ está em excesso. */
export function nextOverloadLevel(
  count: number,
  previous: OverloadLevel | null,
): OverloadLevel {
  if (count >= OVERLOAD_EXCESS_AT) return "excess";
  if (previous === "excess" && count >= OVERLOAD_CLEAR_BELOW) return "excess";
  if (count >= OVERLOAD_WARN_AT) return "warn";
  return "ok";
}

/** Quanto falta resolver para o aviso parar. */
export function overloadToClear(state: OverloadState): number {
  if (state.level === "excess") {
    return Math.max(0, state.count - (OVERLOAD_CLEAR_BELOW - 1));
  }
  if (state.level === "warn") {
    return Math.max(0, state.count - (OVERLOAD_WARN_AT - 1));
  }
  return 0;
}

/** A quem se aplica: consultores de SEO. Os C-Level (isAdmin) e os perfis
 *  só de leitura ficam de fora — os primeiros têm o painel de equipa, os
 *  segundos não têm nada que lhes possa ser pedido. */
export function overloadAppliesTo(person: {
  dept: string;
  isAdmin?: boolean | null;
  viewerOf?: string | null;
}): boolean {
  return person.dept === "SEO" && !person.isAdmin && !person.viewerOf;
}
