// Tools — os acessos das ferramentas da agência, num baralho de cartões.
//
// Entra toda a gente com sessão (o item «Tools» vive no dropdown do nome,
// no header). Ver o username, revelar a password, copiar — e, desde a
// v77.50, o lápis do cartão é de toda a equipa (menos os viewers): quem
// muda a password de uma ferramenta atualiza-a logo aqui, sem ter de
// pedir a um SuperAdmin. Adicionar/remover apps e limpar um cartão
// continuam só SuperAdmin — e a API volta a verificar tudo isto, porque
// esconder um botão não protege nada.

import { PageShell } from "@/components/page-shell";
import { getCurrentEmployee, isCurrentUserAdmin } from "@/lib/auth/server";
import { listWorkspaceTools } from "@/lib/tools-catalogue-store";
import {
  EMPTY_TOOL_ACCESS,
  listToolAccesses,
} from "@/lib/tools-access-store";
import { ToolsDeck, type ToolCard } from "@/components/tools/tools-deck";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Tools — Wonder Ads Workspace",
};

export default async function ToolsPage() {
  const employee = await getCurrentEmployee();
  // O middleware já mandou quem não tem sessão para /login.
  if (!employee) return null;

  const [tools, accesses, canManage] = await Promise.all([
    listWorkspaceTools(),
    listToolAccesses(),
    isCurrentUserAdmin(),
  ]);
  // Os viewers são só de leitura em todo o lado — o middleware já lhes
  // recusa qualquer escrita em /api.
  const canEdit = canManage || !employee.viewerOf;

  const cards: ToolCard[] = tools.map((tool) => ({
    ...tool,
    access: accesses[tool.id] ?? EMPTY_TOOL_ACCESS,
  }));

  return (
    // `wide` tira o max-w-7xl: a pista do baralho ganha ~160px num
    // portátil e os cinco cartões crescem com ela. O teto de 1680px é
    // para os monitores grandes não esticarem cada cartão até meio metro.
    <PageShell wide backHref="/" backLabel="workspace">
      <div className="mx-auto w-full max-w-[1680px]">
        <header className="animate-fade-up mt-2">
          <p className="readout text-white/35">Acessos e Ferramentas</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Tools</span>
          </h1>
        </header>

        <section className="mt-6">
          <ToolsDeck tools={cards} canEdit={canEdit} canManage={canManage} />
        </section>
      </div>
    </PageShell>
  );
}
