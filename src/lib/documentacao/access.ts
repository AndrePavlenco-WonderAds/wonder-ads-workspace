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
  if (reader.viewerOf) return false;
  if ((audience.depts as string[]).includes(reader.dept)) return true;
  return (audience.tags ?? []).some((t) => reader.tags.includes(t));
}
