// SuperAdmin → um Plano de Probation: o editor (com as avaliações) e a
// pré-visualização do documento. Só SuperAdmin, verificado aqui antes de ler
// o plano (o layout de /admin sozinho não basta — ver abaixo).

import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ProbationEditor } from "@/components/probation/probation-editor";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getPlan } from "@/lib/probation/store";
import { probationRoster } from "@/lib/probation/roster";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Plano de probation — SuperAdmin Control Suite",
};

export default async function ProbationPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // O layout de /admin mostra o «SuperAdmin only», mas NÃO chega: no App
  // Router a página renderiza em paralelo com o layout e o payload dela
  // segue na resposta mesmo quando o layout recusa. Dados de RH → a página
  // verifica por conta própria, ANTES de ler o que quer que seja.
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  return (
    <PageShell wide>
      <ProbationEditor
        initial={plan}
        defaults={{ manager: employee.name, direction: employee.name }}
        people={probationRoster()}
      />
    </PageShell>
  );
}
