// Direção → Registar ineficácia (v77.90): a folha RH-04, onde a direção lança
// uma ineficácia de um consultor — o erro cometido, se foi a primeira vez, a
// gravidade e a pontuação — e vê o efeito na escala antes de registar.
// `?consultor=<username>` traz a pessoa já escolhida (vem da ficha dela).
//
// Só SuperAdmin: a página verifica isAdmin ANTES de ler o KV (o layout de
// /admin sozinho não chega).

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { RegisterIneficaciaSheet, type RegisterPerson } from "@/components/ineficacias/register-sheet";
import { getCurrentEmployee } from "@/lib/auth/server";
import { findEmployeeByUsername, listImpersonationTargets, viewerDeptOf } from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";
import { loadTeam } from "@/lib/ineficacias/store";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Registar ineficácia — SuperAdmin Control Suite",
};

export default async function RegisterIneficaciaPage({
  searchParams,
}: {
  searchParams: Promise<{ consultor?: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;
  const today = todayLisbonISO();
  const roster = listImpersonationTargets().filter((p) => !p.isAdmin && !viewerDeptOf(p.username));
  const team = await loadTeam(roster.map((p) => p.username), today);

  // Ao browser só seguem datas e pontuações — o texto das ocorrências fica
  // no servidor (chega para calcular o impacto na escala).
  const people: RegisterPerson[] = roster.map((p) => {
    const b = team.get(p.username);
    return {
      username: p.username,
      name: p.name,
      fullName: findEmployeeByUsername(p.username)?.fullName ?? p.name,
      role: p.role,
      dept: p.dept,
      avatar: getTeamAvatar(p.username),
      occurrences: (b?.occurrences ?? []).map((o) => ({
        ...o,
        what: "",
        client: "",
        shouldHave: "",
        reasonOther: "",
        lastTime: "",
        score: o.score ? { points: o.score.points, by: "", byName: "", at: 0, note: "" } : null,
      })),
      events: (b?.ledger.events ?? []).map((e) =>
        e.kind === "measure" ? { ...e, note: "", actions: [], conductedBy: "" } : { ...e, note: "" },
      ),
    };
  });
  const consultor = (await searchParams).consultor ?? null;
  const self = findEmployeeByUsername(employee.username);

  return (
    <PageShell>
      <Link
        href="/admin/ineficacias"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Ineficácias da equipa
      </Link>
      <header className="animate-fade-up mt-2">
        <p className="readout text-white/35">Operações · Team Inefficiency · Direção</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Registar ineficácia</span>
        </h1>
      </header>
      <div className="animate-fade-up mt-8">
        <RegisterIneficaciaSheet
          people={people}
          today={today}
          initialUsername={consultor}
          adminName={self?.fullName ?? employee.name}
        />
      </div>
    </PageShell>
  );
}
