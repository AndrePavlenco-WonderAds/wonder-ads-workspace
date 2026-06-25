import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { CalendarView, type CalendarInvoice } from "@/components/calendar-view";
import { buildAdminClientViews } from "@/lib/admin-roster";
import { getCalendarEvents } from "@/lib/calendar-events-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Overview Calendário · SuperAdmin — Wonder Ads Workspace",
};

export default async function CalendarPage() {
  const [clients, events] = await Promise.all([
    buildAdminClientViews(),
    getCalendarEvents(),
  ]);

  // Derive invoices (read-only) from each row's invoiceDate.
  const invoices: CalendarInvoice[] = clients
    .filter((c) => c.record.invoiceDate)
    .map((c) => ({
      id: `${c.slug}-${c.department}`,
      date: c.record.invoiceDate as string,
      title: c.title,
      department: c.department,
    }));

  return (
    <PageShell wide>
      <Link
        href="/admin/projects"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Clients
      </Link>
      <CalendarView invoices={invoices} initialEvents={events} />
    </PageShell>
  );
}
