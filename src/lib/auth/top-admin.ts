// O topo da hierarquia (v78.74) — o André Pavlenco, COO: quem tem as
// operações. É SuperAdmin como os outros C-Level (Alex, Alice) e tem ainda o
// que só ele tem. Um só sítio para o decidir:
//
//   • a consola «Acessos à app» (/admin/acessos) — ACCESS_OWNER;
//   • o changelog do workspace (/changelog e o envio para o Slack, v78.75);
//   • o «Ver como» de outro SuperAdmin: só ele o faz (session.ts,
//     /api/auth/impersonate, seletor do user-chip);
//   • o «Ponto da situação» das notificações (notifications/server.ts).
//
// REGRA (v78.75): A DIFERENÇA NÃO SE VÊ DE FORA. Para o Alex e a Alice, o
// que é do topo dá 404 (nunca «só o COO…»), o roster mostra os três SuperAdmins
// iguais, e a regra do «Ver como» é a mesma para os dois — nenhum vê a app
// como outro SuperAdmin —, por isso a ausência do André na lista não se nota.
// Não escrever estas regras em texto que a equipa leia (changelog incluído).
//
// Decide-se sempre com quem FEZ LOGIN (`session.u`) e nunca com a lente.
// Puro e sem segredos: o middleware (Edge) e o browser também o importam.

/** O username do topo — o único acima dos outros SuperAdmins. */
export const TOP_ADMIN_USERNAME = "andre";

export function isTopAdmin(username: string | null | undefined): boolean {
  return typeof username === "string" && username.trim().toLowerCase() === TOP_ADMIN_USERNAME;
}
