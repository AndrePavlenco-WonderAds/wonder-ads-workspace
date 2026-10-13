// O portão «Em construção» do módulo de Ineficácias.
//
// Enquanto o André está a afinar o sistema, a página /ineficacias e a API de
// submissão ficam fechadas a quem não é SuperAdmin: o consultor vê um painel
// «Em construção» e o item do menu leva a pastilha. O interruptor é este
// booleano — quando ele disser para tirar o «Em construção», passa a true e
// tudo abre (página, API, avisos no sino).
//
// A decisão é tomada com QUEM FEZ LOGIN (não com a pessoa vista): assim o
// SuperAdmin pode usar o «Ver como» para testar a vista do consultor sem
// esbarrar no painel. As escritas com lente ativa continuam bloqueadas pelo
// middleware, como em tudo o resto.

export const INEFICACIAS_OPEN_TO_TEAM = false;

/** True quando esta sessão pode usar o módulo. */
export function ineficaciasAvailable(realIsAdmin: boolean): boolean {
  return INEFICACIAS_OPEN_TO_TEAM || realIsAdmin;
}
