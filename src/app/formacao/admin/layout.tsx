import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Gate da área de Superadmin da Formação — mesmo modelo do `/admin`: quem
 * entra é decidido pelo `isAdmin` da credencial na sessão (Andre, Alex,
 * Alice). Um consultor que descubra o URL vê o Access Denied, não a tabela com
 * o progresso dos colegas.
 *
 * Este layout cobre TODAS as páginas em /formacao/admin/** (equipa, gravações,
 * inscrições, CMS e o drill-down por consultor). Não é a única defesa: cada
 * rota da API que escreve (inscrições, conteúdo) volta a verificar `isAdmin`
 * por si, porque um layout só protege o que é renderizado — não protege um
 * `fetch` feito à mão contra o endpoint.
 */
export default async function FormacaoAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const employee = await getCurrentEmployee();
  if (!employee || !employee.isAdmin) {
    return (
      <PageShell>
        <AccessDenied
          title="Só SuperAdmin"
          description="A área de Superadmin da Formação é reservada ao Andre, ao Alex e à Alice. A tua área de formação está em /formacao."
          username={employee?.username ?? null}
        />
      </PageShell>
    );
  }
  return <>{children}</>;
}
