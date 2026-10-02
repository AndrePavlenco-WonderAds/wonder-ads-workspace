// SuperAdmin → Novo Plano de Probation. O plano só nasce no «Criar plano»;
// responsável direto e direção vêm com o nome de quem tem a sessão.

import { PageShell } from "@/components/page-shell";
import { ProbationEditor } from "@/components/probation/probation-editor";
import { getCurrentEmployee } from "@/lib/auth/server";
import { probationRoster } from "@/lib/probation/roster";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Novo plano de probation — SuperAdmin Control Suite",
};

export default async function NewProbationPage() {
  // O layout de /admin mostra o «SuperAdmin only», mas NÃO chega: no App
  // Router a página renderiza em paralelo com o layout e o payload dela
  // segue na resposta mesmo quando o layout recusa. Dados de RH → a página
  // verifica por conta própria, ANTES de ler o que quer que seja.
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;
  return (
    <PageShell wide>
      <ProbationEditor
        initial={null}
        defaults={{ manager: employee.name, direction: employee.name }}
        people={probationRoster()}
      />
    </PageShell>
  );
}
