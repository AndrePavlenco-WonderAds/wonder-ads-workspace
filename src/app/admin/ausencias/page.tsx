// C-Suite → Ausências: a fila de pedidos por decidir + o registo de tudo o
// que já foi decidido. O gate isAdmin vive no layout de /admin; a API de
// decisão volta a verificar por conta própria.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { listAbsences } from "@/lib/absences-store";
import { AdminAbsencesPanel } from "@/components/absences/admin-absences-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Ausências — SuperAdmin Control Suite",
};

export default async function AdminAusenciasPage() {
  const all = await listAbsences();

  return (
    <PageShell>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Control Suite
      </Link>
      <AdminAbsencesPanel initial={all} />
    </PageShell>
  );
}
