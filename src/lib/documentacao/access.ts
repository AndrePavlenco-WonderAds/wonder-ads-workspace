// Documentação da empresa (v78.5; chamou-se «Playbook» até v78.6) — o hub de
// documentação e SOPs.
//
// EM CONSTRUÇÃO: só o André Pavlenco entra. A decisão é tomada com QUEM FEZ
// LOGIN (não com a pessoa vista), como nas Ineficácias: assim o André usa o
// «Ver como» para ver os blocos que um consultor vai ver, sem esbarrar no
// portão. Para abrir à equipa, `DOCS_OPEN_TO_TEAM = true` — a partir daí
// cada pessoa vê os blocos do seu departamento (ver `blocks.ts`).

import type { DeptSlug } from "@/lib/auth/credentials";

export const DOCS_OPEN_TO_TEAM = false;

/** Quem entra enquanto o hub está em construção. */
const DOCS_BUILDERS = new Set(["andre"]);

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
};

/** Público de um bloco: SuperAdmins + os departamentos listados. Os perfis
 *  viewer (só leitura) ficam sempre de fora — não são da equipa do bloco. */
export type BlockAudience = {
  depts: Array<"SEO" | "ADS" | "Web" | "Commercial">;
};

export function readerSees(reader: DocsReader, audience: BlockAudience): boolean {
  if (reader.isAdmin) return true;
  if (reader.viewerOf) return false;
  return (audience.depts as string[]).includes(reader.dept);
}
