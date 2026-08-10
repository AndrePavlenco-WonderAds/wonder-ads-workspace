// SEO → Weekly Reports: uma página só, partilhada por todos os consultores.
//
// PORQUE NÃO É POR CLIENTE (era, até à v76.45): o weekly report não se
// escreve cliente a cliente — escreve-se uma vez por semana, a partir dos
// daily updates, e desses sai a semana de TODA a carteira de uma vez. O
// botão antigo vivia no roadmap de cada cliente e obrigava a repetir o
// mesmo trabalho tantas vezes quantos os clientes; e, pior, lia só o
// roadmap, que diz o que estava PLANEADO e não o que foi realmente feito.
//
// A fonte da verdade do que foi feito é o daily update — o texto que o
// consultor já escreve todos os dias. Esta página lê-o e devolve uma
// mensagem por cliente, pronta a colar no grupo de WhatsApp dele.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Info } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { WeeklyReportStudio } from "@/components/weekly-report-studio";
import { getCurrentEmployee } from "@/lib/auth/server";
import { weekdayBlocks } from "@/lib/seo-tools/daily-updates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Weekly Reports · SEO DPT — Wonder Ads Workspace",
};

export default async function WeeklyReportsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login?next=/seo/weekly-reports");

  const days = weekdayBlocks(new Date());

  return (
    <PageShell backHref="/seo" backLabel="SEO DPT" wide>
      <Link
        href="/seo"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        SEO DPT
      </Link>

      <div className="animate-fade-up mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Weekly Reports</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Cola os daily updates da semana e sai um ponto de situação por
            cliente, pronto a colar no grupo de WhatsApp dele. O que foi feito
            vem dos daily updates; o que vem a seguir vem do roadmap de cada
            cliente.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[12px] text-white/65">
          <CalendarDays className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
          Semana de {days[0].date} a {days[days.length - 1].date}
        </span>
      </div>

      <p className="animate-fade-up mt-5 flex items-start gap-2 rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-white/60">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-purple)]" />
        <span>
          Os clientes são reconhecidos pelos cabeçalhos do daily update — uma
          linha com o nome do cliente terminada em dois pontos («
          <span className="text-white/85">White Clinic:</span>») e o trabalho
          dele por baixo, em bullets. Um nome que não bata com a carteira SEO
          aparece à mesma, marcado a amarelo para confirmares.
        </span>
      </p>

      <WeeklyReportStudio days={days} />
    </PageShell>
  );
}
