// SuperAdmin → Penalizações. Every consultant across every department, with
// their disciplinary record. Gated by the /admin layout (isAdmin).

import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminPenaltiesPanel } from "@/components/admin-penalties-panel";
import {
  listPenalties,
  summarise,
} from "@/lib/admin-penalties-store";
import {
  listEmployees,
  SEED_EMPLOYEES,
  defaultEmployeeRecord,
} from "@/lib/admin-employees-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Penalizações — SuperAdmin Control Suite",
};

export default async function AdminPenaltiesPage() {
  // Roster seeds the list so a clean sheet still shows a row — the point is
  // to see the whole team, not only the people with a record.
  let roster: { id: string; name: string; departments: string[] }[] = [];
  try {
    roster = (await listEmployees()).map((e) => ({
      id: e.id,
      name: e.name,
      departments: e.departments,
    }));
  } catch {
    roster = SEED_EMPLOYEES.map(defaultEmployeeRecord).map((e) => ({
      id: e.id,
      name: e.name,
      departments: e.departments,
    }));
  }

  const penalties = await listPenalties();
  const summaries = summarise(penalties, roster);

  return (
    <PageShell wide>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        SuperAdmin Control Suite
      </Link>

      <div className="animate-fade-up mt-6 mb-8">
        <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight sm:text-4xl">
          <ShieldAlert className="h-7 w-7 text-[#b79bff]" />
          <span className="brand-gradient-text">Penalizações</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Registo disciplinar de toda a equipa, por departamento. Cada
          penalização tem uma gravidade de 1 a 3, um título e uma descrição.
          Remover uma penalização exige um motivo e mantém-na no histórico —
          um registo que se pode apagar em silêncio não serve de prova.
        </p>
      </div>

      <AdminPenaltiesPanel summaries={summaries} />
    </PageShell>
  );
}
