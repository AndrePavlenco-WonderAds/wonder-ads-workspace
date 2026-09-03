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

  const withAccess = cards.filter(
    (c) => c.access.username || c.access.password,
  ).length;

  return (
    <PageShell backHref="/" backLabel="workspace">
      <header className="animate-fade-up mt-2">
        <p className="readout text-white/35">Acessos e Ferramentas</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Tools</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45">
          As contas que a Wonder Ads paga e a equipa usa. Passa o rato por um
          cartão, revela a password e copia — {canEdit ? "e usa o lápis para atualizar um acesso." : "os acessos são geridos pelos SuperAdmins."}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-[440px]">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
            <p className="tabular text-[20px] font-semibold leading-none text-white">
              {cards.length}
            </p>
            <p className="readout mt-1.5 text-white/35">Ferramentas</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
            <p
              className={`tabular text-[20px] font-semibold leading-none ${
                withAccess === cards.length ? "text-white" : "text-amber-300"
              }`}
            >
              {withAccess}
            </p>
            <p className="readout mt-1.5 text-white/35">Com acesso definido</p>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <ToolsDeck tools={cards} canEdit={canEdit} />
      </section>
    </PageShell>
  );
}
