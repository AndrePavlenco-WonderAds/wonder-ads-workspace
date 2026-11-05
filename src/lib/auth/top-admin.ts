// O topo da hierarquia (v78.74) — o André Pavlenco, COO: quem tem as
// operações. É SuperAdmin como os outros C-Level (Alex, Alice) e tem ainda o
// que só ele tem. Um só sítio para o decidir:
//
//   • a consola «Acessos à app» (/admin/acessos) — ACCESS_OWNER;
//   • ninguém o pode «Ver como»: só ele vê a app como qualquer pessoa,
//     incluindo os outros SuperAdmins (session.ts, /api/auth/impersonate);
//   • o «Ponto da situação» das notificações (notifications/server.ts);
//   • a etiqueta «SuperAdmin · topo» no Team Roster (/admin/employees).
//
// Decide-se sempre com quem FEZ LOGIN (`session.u`) e nunca com a lente.
// Puro e sem segredos: o middleware (Edge) e o browser também o importam.

/** O username do topo — o único acima dos outros SuperAdmins. */
export const TOP_ADMIN_USERNAME = "andre";

export function isTopAdmin(username: string | null | undefined): boolean {
  return typeof username === "string" && username.trim().toLowerCase() === TOP_ADMIN_USERNAME;
}
