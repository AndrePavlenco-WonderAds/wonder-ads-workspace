// Tools — os acessos das ferramentas da agência, num baralho de cartões.
//
// Entra toda a gente com sessão (o item «Tools» vive no dropdown do nome,
// no header) e para quase toda a gente a página é só de leitura: ver o
// username, revelar a password, copiar. Só os SuperAdmins veem o lápis
// no canto do cartão — e a API volta a verificar isso, porque esconder
// um botão não protege nada.

import { PageShell } from "@/components/page-shell";
import { getCurrentEmployee, isCurrentUserAdmin } from "@/lib/auth/server";
import { WORKSPACE_TOOLS } from "@/lib/tools-catalogue";
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

  const [accesses, canEdit] = await Promise.all([
    listToolAccesses(),
    isCurrentUserAdmin(),
  ]);

  const cards: ToolCard[] = WORKSPACE_TOOLS.map((tool) => ({
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
          <ToolsDeck tools={cards} canEdit={canEdit} />
        </section>
      </div>
    </PageShell>
  );
}
