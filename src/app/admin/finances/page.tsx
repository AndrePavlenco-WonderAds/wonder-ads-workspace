import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { UpcomingActions, type UpcomingInvoice } from "@/components/upcoming-actions";
import { buildAdminClientViews } from "@/lib/admin-roster";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Finances · SuperAdmin — Wonder Ads Workspace",
};

export default async function FinancesAdminPage() {
  const clients = await buildAdminClientViews();

  // Same derivation the Clients table uses to feed the Próx. 7/30 dias
  // blocks — one upcoming invoice per (client, department) that has an
  // invoice date set.
  const invoices: UpcomingInvoice[] = clients
    .filter((c) => c.record.invoiceDate)
    .map((c) => ({
      id: `${c.slug}-${c.department}`,
      title: c.title,
      department: c.department,
      date: c.record.invoiceDate as string,
    }));

  return (
    <PageShell wide>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Admin
      </Link>

      <div className="animate-fade-up mt-2">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              <span className="brand-gradient-text">Finances</span>
            </h1>
            <p className="mt-1.5 text-[12px] text-white/45">
              Calendário de faturação e obrigações fiscais — o que tens de
              tratar nos próximos 7 e 30 dias.
            </p>
          </div>
          <Link
            href="/admin/calendar"
            className="inline-flex items-center gap-2 rounded-xl border border-[#783DF5]/40 bg-[#783DF5]/12 px-3.5 py-2 text-[12.5px] font-semibold text-[#d4c4ff] transition hover:border-[#783DF5]/70 hover:bg-[#783DF5]/20 hover:text-white"
          >
            <CalendarDays className="h-4 w-4" />
            Overview Calendário
          </Link>
        </header>

        {/* Next actions — invoices + events landing in the next 7 / 30 days */}
        <UpcomingActions invoices={invoices} />
      </div>
    </PageShell>
  );
}
