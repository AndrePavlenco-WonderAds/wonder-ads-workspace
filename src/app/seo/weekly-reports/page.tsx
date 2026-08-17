// SEO → Weekly Reports: uma página só, partilhada por todos os consultores.
//
// PORQUE NÃO É POR CLIENTE (era, até à v76.45): o weekly report não se
// escreve cliente a cliente — escreve-se uma vez por semana, a partir dos
// daily updates, e desses sai a semana de TODA a carteira de uma vez. O
// botão antigo vivia no roadmap de cada cliente e obrigava a repetir o
// mesmo trabalho tantas vezes quantos os clientes; e, pior, lia só o
// roadmap, que diz o que estava PLANEADO e não o que foi realmente feito.
//
// Desde a v76.73 a entrada é o menu do consultor (o chip do canto superior
// direito), não o roadmap de um cliente: isto é trabalho DELE, semanal, sobre
// a carteira toda — não é uma ação sobre um cliente em particular.
//
// A fonte da verdade do que foi feito é o daily update — o texto que o
// consultor já escreve todos os dias. Esta página lê-o e devolve uma
// mensagem por cliente, pronta a colar no grupo de WhatsApp dele.

import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { WeeklyReportStudio } from "@/components/weekly-report-studio";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getSeoClients } from "@/lib/notion";
import { resolveConsultant } from "@/lib/client-overrides";
import { weekdayBlocks } from "@/lib/seo-tools/daily-updates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Weekly Reports · SEO DPT — Wonder Ads Workspace",
};

export default async function WeeklyReportsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login?next=/seo/weekly-reports");
  if (!editableDepts(employee).includes("seo")) redirect("/seo");

  // A carteira do consultor é o contrato da página: um cartão de mensagem por
  // cliente dela, sempre. Resolve-se por resolveConsultant e não pelo campo em
  // cache — uma passagem de carteira em código ganha à cache de 1 hora.
  const portfolio = (await getSeoClients().catch(() => []))
    .filter((c) => resolveConsultant(c.slug, c.consultant) === employee.name)
    .map((c) => ({ slug: c.slug, title: c.title }));

  const days = weekdayBlocks(new Date());
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <PageShell backHref="/seo" backLabel="SEO DPT" wide>
      <header className="animate-fade-up mt-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="max-w-2xl">
            <p className="readout text-white/40">
              SEO · Ponto de situação semanal
            </p>
            <h1 className="mt-2.5 text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
              <span className="brand-gradient-text">Weekly Reports</span>
            </h1>
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/55">
              Cola a semana de daily updates. A app cruza-a com a tua carteira,
              vai ao roadmap de cada cliente buscar o que está programado para
              a semana que vem, e escreve uma mensagem por cliente teu — pronta
              a colar no grupo de WhatsApp dele.
            </p>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <CalendarDays className="h-4 w-4 text-[color:var(--brand-purple)]" />
            <span>
              <span className="readout block text-white/35">Semana</span>
              <span className="tabular text-[14px] font-semibold tracking-tight text-white">
                {first.date} — {last.date}
              </span>
            </span>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-[12.5px] leading-relaxed text-white/40">
          Os clientes são reconhecidos pelos cabeçalhos do daily update — o
          nome do cliente numa linha própria, com ou sem dois pontos («
          <span className="text-white/70">White Clinic:</span>» ou só «
          <span className="text-white/70">White Clinic</span>»), e o trabalho
          por baixo. Grafias diferentes do mesmo cliente ao longo da semana são
          juntas automaticamente; um cliente teu sem trabalho na semana aparece
          na mesma, com aviso — nenhum grupo fica sem mensagem.
        </p>
      </header>

      <WeeklyReportStudio days={days} portfolio={portfolio} />
    </PageShell>
  );
}
