// /admin/passagens/nova — abrir a passagem de um consultor (v80.40).
// Só SuperAdmin (a página verifica-o ela própria).

import { PageShell } from "@/components/page-shell";
import { CreatePassagem, type CreateConsultant } from "@/components/passagem/create-passagem";
import { PageHeader } from "@/components/passagem/ui";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getTeamAvatar } from "@/lib/team-avatars";
import { getPassagemIndex, seoPortfolios } from "@/lib/passagem/store";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Nova passagem — Wonder Ads Workspace" };

export default async function NovaPassagemPage() {
  const me = await getCurrentEmployee();
  if (!me?.isAdmin) {
    return (
      <PageShell backHref="/" backLabel="workspace" backPrefix="Voltar a">
        <PageHeader eyebrow="SuperAdmin" title="Nova passagem" lead="Esta página é só para SuperAdmin." />
      </PageShell>
    );
  }
  const [index, portfolios] = await Promise.all([getPassagemIndex(), seoPortfolios()]);
  const busy = new Set(index.filter((e) => e.status === "ativa").map((e) => e.outgoing));
  const consultants: CreateConsultant[] = portfolios.map((c) => ({
    ...c,
    avatar: getTeamAvatar(c.username),
    busy: busy.has(c.username),
  }));

  return (
    <PageShell backHref="/admin/passagens" backLabel="Passagens" backPrefix="Voltar a">
      <PageHeader
        eyebrow="SuperAdmin · offboarding"
        title="Nova passagem"
        lead="Quem sai, até quando e quem fica com cada projeto. À direita vês a carga de cada colega antes e depois, para ninguém ficar sobrecarregado."
      />
      <div className="mt-8 pb-14">
        <CreatePassagem consultants={consultants} today={todayLisbonISO()} />
      </div>
    </PageShell>
  );
}
