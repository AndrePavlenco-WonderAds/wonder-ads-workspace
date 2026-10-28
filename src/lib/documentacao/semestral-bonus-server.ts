// O lado servidor do bónus semestral: lê as ineficácias de quem a página
// pode mostrar — a equipa toda para a direção, só o próprio para os
// restantes — e devolve números, nunca o texto das ocorrências.

import "server-only";
import { findEmployeeByUsername, listImpersonationTargets, viewerDeptOf } from "@/lib/auth/credentials";
import { loadTeam } from "@/lib/ineficacias/store";
import { getTeamAvatar } from "@/lib/team-avatars";
import { semesterOf, tallySemester, type Semester, type SemesterTally } from "./semestral-bonus";

export type SemesterRow = SemesterTally & { username: string; name: string; dept: string; avatar: string | null };

export type SemesterBoard = { semester: Semester; rows: SemesterRow[] };

export async function buildSemesterBoard(opts: { username: string; all: boolean; todayISO: string }): Promise<SemesterBoard> {
  const semester = semesterOf(opts.todayISO);
  const people = opts.all
    ? listImpersonationTargets().filter((p) => !p.isAdmin && !viewerDeptOf(p.username))
    : [findEmployeeByUsername(opts.username)].filter((p): p is NonNullable<typeof p> => Boolean(p));
  const team = await loadTeam(
    people.map((p) => p.username),
    opts.todayISO,
  );
  const rows = people.map((p) => ({
    username: p.username,
    name: p.name,
    dept: p.dept,
    avatar: getTeamAvatar(p.username),
    ...tallySemester(team.get(p.username)?.occurrences ?? [], semester, opts.todayISO),
  }));
  return { semester, rows };
}
