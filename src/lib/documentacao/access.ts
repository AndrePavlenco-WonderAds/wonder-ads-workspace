// Documentação da empresa (v78.5; chamou-se «Playbook» até v78.6) — o hub de
// documentação e SOPs.
//
// ABERTA À EQUIPA desde a v78.57 (pedido do André, 30/10/2026): cada pessoa
// vê os blocos do seu departamento (ver `blocks.ts`). Até lá esteve em
// construção, só para o André e o Alex Pavlenco. A decisão é tomada com QUEM
// FEZ LOGIN (não com a pessoa vista), como nas Ineficácias: assim o André usa
// o «Ver como» para ver os blocos que um consultor vê, sem esbarrar no
// portão. Para a fechar outra vez, `DOCS_OPEN_TO_TEAM = false`.

import type { DeptSlug } from "@/lib/auth/credentials";

export const DOCS_OPEN_TO_TEAM = true;

/** Quem entra enquanto o hub está em construção. */
const DOCS_BUILDERS = new Set(["andre", "alex"]);

/** True quando quem FEZ LOGIN pode abrir o hub. */
export function docsAvailable(realUsername: string | null | undefined): boolean {
  if (!realUsername) return false;
  return DOCS_OPEN_TO_TEAM || DOCS_BUILDERS.has(realUsername.trim().toLowerCase());
}

/** A forma mínima da pessoa VISTA que decide que blocos aparecem. */
export type DocsReader = {
  username: string;
  name: string;
  dept: string;
  isAdmin: boolean;
  viewerOf: DeptSlug | null;
  /** Etiquetas da credencial («Treinador») — alguns blocos abrem por aqui. */
  tags: string[];
  /** Conta «só Documentação» (v80.10, externos): os ÚNICOS blocos que lê.
   *  Ausente/null para a equipa. */
  docsOnly?: string[] | null;
};

/** Público de um bloco: SuperAdmins + os departamentos listados + quem tem
 *  uma das etiquetas listadas. Os perfis viewer (só leitura) ficam sempre de
 *  fora — não são da equipa do bloco. */
export type BlockAudience = {
  depts: Array<"SEO" | "ADS" | "Web" | "Commercial">;
  tags?: string[];
};

export function readerSees(reader: DocsReader, audience: BlockAudience): boolean {
  if (reader.isAdmin) return true;
  // Contas «só Documentação»: nenhum público as inclui — só a lista branca
  // delas, em `readerSeesBlock`. Assim qualquer outro teste por público (o
  // bónus nas Ineficácias, o sino das alterações…) dá sempre «não».
  if (reader.docsOnly) return false;
  if (reader.viewerOf) return false;
  if ((audience.depts as string[]).includes(reader.dept)) return true;
  return (audience.tags ?? []).some((t) => reader.tags.includes(t));
}

/** Se a pessoa lê um BLOCO (v80.10). Para a equipa é o público do bloco; para
 *  uma conta «só Documentação» é só a lista branca dela. É esta que o hub e
 *  as páginas usam. */
export function readerSeesBlock(reader: DocsReader, block: { id: string; audience: BlockAudience }): boolean {
  if (reader.docsOnly) return reader.docsOnly.includes(block.id);
  return readerSees(reader, block.audience);
}
