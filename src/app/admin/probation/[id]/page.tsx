// SuperAdmin → um Plano de Probation: o editor (com as avaliações) e a
// pré-visualização do documento. Só SuperAdmin, verificado aqui antes de ler
// o plano (o layout de /admin sozinho não basta — ver abaixo).

import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ProbationEditor } from "@/components/probation/probation-editor";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getPlan, getPublished } from "@/lib/probation/store";
import { probationRoster } from "@/lib/probation/roster";
import { todayLisbonISO } from "@/lib/probation/progress";

const TABS = ["plano", "semanas", "avaliacoes", "envios"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Plano de probation — SuperAdmin Control Suite",
};

export default async function ProbationPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; semana?: string }>;
}) {
  // O layout de /admin mostra o «SuperAdmin only», mas NÃO chega: no App
  // Router a página renderiza em paralelo com o layout e o payload dela
  // segue na resposta mesmo quando o layout recusa. Dados de RH → a página
  // verifica por conta própria, ANTES de ler o que quer que seja.
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;
  const { id } = await params;
  const sp = await searchParams;
  const [plan, pub] = await Promise.all([getPlan(id), getPublished(id)]);
  if (!plan) notFound();
  // ?tab=semanas&semana=2 — os links do sino abrem no sítio certo.
  const tab = TABS.find((t) => t === sp.tab) ?? "plano";
  const week = Number(sp.semana);
  return (
    <PageShell wide>
      <ProbationEditor
        initial={plan}
        initialPub={pub}
        defaults={{ manager: employee.name, direction: employee.name }}
        people={probationRoster()}
        today={todayLisbonISO()}
        initialTab={tab}
        initialWeek={Number.isInteger(week) ? week : undefined}
      />
    </PageShell>
  );
}
