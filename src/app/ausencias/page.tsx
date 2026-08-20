// Ausências — a folha de pedido (RH-01) + o histórico do próprio.
//
// Toda a gente com sessão entra (o item «Pedir Ausência» vive no dropdown
// do nome, no header). A decisão é do C-Level e mora em /admin/ausencias;
// aqui a pessoa pede, acompanha e acusa a resposta como entendida.

import { PageShell } from "@/components/page-shell";
import { getCurrentEmployee } from "@/lib/auth/server";
import { listAbsencesForUser } from "@/lib/absences-store";
import { AbsenceRequestForm } from "@/components/absences/absence-request-form";
import { AbsenceHistory } from "@/components/absences/absence-history";
import { formatDayCount } from "@/lib/absences-shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Ausências — Wonder Ads Workspace",
};

export default async function AusenciasPage() {
  const employee = await getCurrentEmployee();
  // O middleware já mandou quem não tem sessão para /login.
  if (!employee) return null;

  const mine = await listAbsencesForUser(employee.username);
  // Os dois tipos de folha contam à parte em TODO o lado: dias de férias
  // aprovados nunca podem entrar no mesmo número que dias de falta.
  const requests = mine.filter((a) => a.kind !== "falta");
  const faltas = mine.filter((a) => a.kind === "falta");
  const pendingCount = requests.filter((a) => a.status === "pending").length;
  const year = new Date().getFullYear();
  const approvedBusinessDays = requests
    .filter(
      (a) => a.status === "approved" && a.startDate.startsWith(String(year)),
    )
    .reduce((sum, a) => sum + a.businessDays, 0);
  const faltasThisYear = faltas.filter((a) =>
    a.startDate.startsWith(String(year)),
  );

  return (
    <PageShell backHref="/" backLabel="workspace">
      <header className="animate-fade-up mt-2">
        <p className="readout text-white/35">Recursos Humanos</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Pedido de Ausência</span>
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-[680px] sm:grid-cols-4">
          {[
            {
              label: "Por decidir",
              value: String(pendingCount),
              tone: pendingCount > 0 ? "text-amber-300" : "text-white",
            },
            {
              label: `Dias úteis aprovados · ${year}`,
              value: approvedBusinessDays > 0 ? formatDayCount(approvedBusinessDays) : "0",
              tone: "text-white",
            },
            {
              label: `Faltas registadas · ${year}`,
              value: String(faltasThisYear.length),
              tone: faltasThisYear.length > 0 ? "text-amber-300" : "text-white",
            },
            {
              label: "Pedidos no total",
              value: String(requests.length),
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
        <AbsenceRequestForm
          employee={{
            username: employee.username,
            name: employee.name,
            role: employee.role,
            dept: employee.dept,
          }}
        />
      </div>

      <div className="mt-14">
        <AbsenceHistory initial={mine} />
      </div>
    </PageShell>
  );
}
