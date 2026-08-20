// C-Suite → Faltas: a folha RH-02 para lançar uma falta a alguém, e o registo
// de tudo o que já foi lançado. O gate isAdmin vive no layout de /admin; a
// API de criação volta a verificar por conta própria.

import Link from "next/link";
import { ArrowLeft, CalendarOff } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { getCurrentEmployee } from "@/lib/auth/server";
import { listImpersonationTargets } from "@/lib/auth/credentials";
import { listAbsences } from "@/lib/absences-store";
import {
  buildMonthlyDigest,
  previousMonth,
} from "@/lib/absences-monthly";
import { ausenciasSlackConfigured } from "@/lib/slack";
import { FaltaRegisterForm } from "@/components/absences/falta-register-form";
import { FaltaRegistry } from "@/components/absences/falta-registry";
import { MonthlyDigestCard } from "@/components/absences/monthly-digest-card";
import { formatDayCount } from "@/lib/absences-shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Faltas — SuperAdmin Control Suite",
};

export default async function AdminFaltasPage() {
  const employee = await getCurrentEmployee();
  // O layout de /admin já barrou quem não é superadmin.
  if (!employee) return null;

  // Uma leitura só do KV serve as duas coisas: o registo de faltas e o
  // resumo mensal (que precisa dos pedidos aprovados também).
  const all = await listAbsences();
  const faltas = all.filter((a) => a.kind === "falta");
  const { year: digestYear, month: digestMonth } = previousMonth(new Date());
  const digest = buildMonthlyDigest(all, digestYear, digestMonth);
  const year = new Date().getFullYear();
  const thisYear = faltas.filter((f) => f.startDate.startsWith(String(year)));
  const unjustifiedDays = thisYear
    .filter((f) => f.justified !== true)
    .reduce((s, f) => s + f.businessDays, 0);
  const pendingAck = faltas.filter((f) => !f.acknowledgedAt).length;

  // Toda a gente do roster pode levar uma falta — incluindo os outros
  // superadmins. Quem lança é que tem de ser C-Level, não quem leva.
  const people = listImpersonationTargets().map((p) => ({
    username: p.username,
    name: p.name,
    role: p.role,
    dept: p.dept,
  }));

  return (
    <PageShell>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Control Suite
      </Link>

      <header className="animate-fade-up mt-2">
        <p className="readout text-white/35">Recursos Humanos · Direção</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Registar Falta</span>
        </h1>
        <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-relaxed text-white/45">
          A folha RH-02 lança uma falta no histórico de um colaborador. Não há aprovação:
          assinaste, ficou registada — e a pessoa recebe-a no sino com o motivo e o teu nome.
          No dia 1 de cada mês, tudo isto vai num resumo para o #ausencias.{" "}
          <Link
            href="/admin/ausencias"
            className="font-medium text-[#c3aaff] underline-offset-2 hover:underline"
          >
            Os pedidos de ausência decidem-se aqui →
          </Link>
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-[520px]">
          {[
            {
              label: `Faltas · ${year}`,
              value: String(thisYear.length),
              tone: thisYear.length > 0 ? "text-amber-300" : "text-white",
            },
            {
              label: `Dias úteis injustificados · ${year}`,
              value: unjustifiedDays > 0 ? formatDayCount(unjustifiedDays) : "0",
              tone: unjustifiedDays > 0 ? "text-rose-300" : "text-white",
            },
            {
              label: "Por acusar receção",
              value: String(pendingAck),
              tone: "text-white",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3"
            >
              <p className={`tabular text-[20px] font-semibold leading-none ${s.tone}`}>
                {s.value}
              </p>
              <p className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="animate-fade-up mt-10">
        <FaltaRegisterForm
          people={people}
          registrar={{ username: employee.username, name: employee.name }}
        />
      </div>

      <FaltaRegistry faltas={faltas} />

      <MonthlyDigestCard digest={digest} slackConfigured={ausenciasSlackConfigured()} />

      <p className="mt-10 flex items-center gap-2 text-[11px] text-white/30">
        <CalendarOff className="h-3.5 w-3.5" />
        Formulário RH-02 · Wonder Ads
      </p>
    </PageShell>
  );
}
