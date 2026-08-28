// C-Suite → Ausências: a fila de PEDIDOS por decidir + o registo de tudo o
// que já foi decidido. O gate isAdmin vive no layout de /admin; a API de
// decisão volta a verificar por conta própria.
//
// As faltas lançadas pelo C-Level são o outro lado da casa e vivem em
// /admin/faltas — o link está no cabeçalho do painel.
//
// Em baixo, o fecho do mês: o balanço dos pedidos que sai sozinho para o
// #ausencias no último dia de cada mês, pré-visualizável e reenviável daqui.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { listAbsences } from "@/lib/absences-store";
import {
  buildMonthClose,
  lisbonToday,
  monthBefore,
} from "@/lib/absences-month-close";
import { ausenciasSlackConfigured } from "@/lib/slack";
import { AdminAbsencesPanel } from "@/components/absences/admin-absences-panel";
import { MonthCloseCard } from "@/components/absences/month-close-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Ausências — SuperAdmin Control Suite",
};

export default async function AdminAusenciasPage() {
  // Uma leitura só do KV serve as duas coisas: o painel (só as folhas RH-01
  // — as faltas não têm nada a decidir e vivem em /admin/faltas) e o fecho
  // do mês, que também só olha para os pedidos.
  const all = await listAbsences();
  const requests = all.filter((a) => a.kind === "request");

  const today = lisbonToday();
  const prev = monthBefore(today.year, today.month);
  const current = buildMonthClose(all, today.year, today.month);
  const previous = buildMonthClose(all, prev.year, prev.month);

  return (
    <PageShell>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Control Suite
      </Link>
      <AdminAbsencesPanel initial={requests} />
      <MonthCloseCard
        current={current}
        previous={previous}
        slackConfigured={ausenciasSlackConfigured()}
      />
    </PageShell>
  );
}
