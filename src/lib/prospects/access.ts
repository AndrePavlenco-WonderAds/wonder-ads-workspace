// Quem lê e quem escreve na Ficha do prospect (v80.0).
//
// LER: toda a gente com sessão na workspace — todos os departamentos, os
// comerciais e os perfis só de leitura. A ficha é privada à casa, não a um
// departamento: o consultor que recebe o cliente, o Web que lhe faz o site e
// o ADS que lhe pode vir a vender campanhas leem o mesmo.
//
// ESCREVER: quem vende ou recebe o cliente —
//   • SuperAdmins;
//   • a equipa Comercial (dept «Commercial»), MESMO sendo viewers do SEO: é
//     a exceção que o middleware abre só para /prospects e /api/prospects;
//   • quem edita o Comercial (consultores de SEO e ADS, que também fecham
//     renovações e cross-sells).
// Fica só de leitura: Web designers e viewers que não são comerciais (Gabi).
//
// Isto corre só no servidor (lê as credenciais).

import "server-only";
import {
  EMPLOYEE_CREDENTIALS,
  editableDepts,
  findEmployeeByUsername,
  type DeptSlug,
} from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";

type Row = {
  dept: string;
  isAdmin?: boolean | null;
  viewerOf?: string | null;
  readOnlyDepts?: string[] | null;
};

export function canWriteProspects(row: Row | null | undefined): boolean {
  if (!row) return false;
  if (row.isAdmin) return true;
  if (row.dept === "Commercial") return true;
  return editableDepts({
    dept: row.dept,
    isAdmin: Boolean(row.isAdmin),
    viewerOf: (row.viewerOf ?? null) as DeptSlug | null,
    readOnlyDepts: (row.readOnlyDepts ?? []) as DeptSlug[],
  }).includes("commercial");
}

export function canWriteProspectsUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  return canWriteProspects(findEmployeeByUsername(username));
}

export type ProspectPerson = {
  username: string;
  name: string;
  role: string;
  avatar: string | null;
  /** Pode ser escolhido como «comercial responsável». */
  canOwn: boolean;
  /** Ordem no seletor: Comercial primeiro, depois direção, depois o resto. */
  rank: number;
};

/** O diretório da equipa para a ficha: nomes e retratos de quem escreveu, e
 *  quem pode ser o comercial responsável. Sem nada de credenciais. */
export function prospectPeople(): ProspectPerson[] {
  return EMPLOYEE_CREDENTIALS.map((c) => {
    const canOwn = canWriteProspects(c);
    const rank = c.dept === "Commercial" ? 0 : c.isAdmin ? 1 : 2;
    return {
      username: c.username,
      name: c.name,
      role: c.role,
      avatar: getTeamAvatar(c.username),
      canOwn,
      rank,
    };
  });
}
