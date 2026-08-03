import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Gate do overview da Formação — mesmo modelo do `/admin`: quem entra é
 * decidido pelo `isAdmin` da credencial na sessão (Andre, Alex, Alice).
 * Um consultor que descubra o URL vê o Access Denied, não a tabela com o
 * progresso dos colegas.
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
          title="Só C-Level"
          description="O overview da Formação é reservado ao C-Level (Andre, Alex, Alice). A tua área de formação está em /formacao."
          username={employee?.username ?? null}
        />
      </PageShell>
    );
  }
  return <>{children}</>;
}
