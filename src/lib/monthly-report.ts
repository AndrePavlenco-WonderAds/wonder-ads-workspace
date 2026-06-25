// Aggregates the Clients roster + calendar + completed-actions state
// into the numbers behind the Monthly Report. Everything is derived
// from current-state data (there's no historical revenue ledger), so
// the quarter / YTD figures are clearly-labelled estimates built from
// each client's monthly-equivalent value × months active.

import "server-only";
import { buildAdminClientViews } from "./admin-roster";
import { getCalendarEvents, type CalendarEvent } from "./calendar-events-store";
import { getDoneActions } from "./actions-done-store";
import { INVOICE_TYPES, type ClientDepartment, type InvoiceType } from "./admin-clients-store";

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export type DeptStat = {
  dept: ClientDepartment;
  engagements: number;
  mrr: number;
};
export type InvoiceTypeStat = {
  type: InvoiceType;
  count: number;
  value: number;
};
export type ReportClientRow = {
  slug: string;
  title: string;
  department: ClientDepartment;
  monthlyValue: number | null;
  iva: number | null;
  invoiceType: InvoiceType;
  invoiceDate: string | null;
};

export type MonthlyReport = {
  generatedAtISO: string;
  monthLabel: string; // "Junho 2026"
  quarterLabel: string; // "T2 2026"
  ytdLabel: string; // "Jan – Jun 2026"
  // KPIs
  clientCount: number;
  engagementCount: number;
  mrr: number;
  ivaTotal: number;
  avgTicket: number;
  annualRunRate: number;
  // breakdowns
  byDepartment: DeptStat[];
  byInvoiceType: InvoiceTypeStat[];
  // este mês
  month: {
    invoicesDue: number;
    invoicesValue: number;
    invoicesIva: number;
    invoicesSent: number;
    events: Array<Pick<CalendarEvent, "date" | "title" | "color">>;
  };
  // trimestre
  quarter: {
    newClients: number;
    invoicesDue: number;
    runRate: number; // MRR × 3
    ivaEstimate: number;
  };
  // desde Janeiro
  ytd: {
    newClients: number;
    billedEstimate: number;
    ivaEstimate: number;
    monthsCovered: number;
  };
  // full table (sorted by monthly value desc)
  clients: ReportClientRow[];
};

function parseISO(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Months a client has been active within the current calendar year,
 *  inclusive of the current month. No start date → assume active since
 *  January. */
function monthsActiveYTD(startingDate: string | null, now: Date): number {
  const currentIdx = now.getMonth(); // 0-based
  const start = parseISO(startingDate);
  if (!start) return currentIdx + 1;
  if (start.getFullYear() > now.getFullYear()) return 0;
  const startIdx = start.getFullYear() < now.getFullYear() ? 0 : start.getMonth();
  if (startIdx > currentIdx) return 0;
  return currentIdx - startIdx + 1;
}

export async function buildMonthlyReport(
  now: Date = new Date(),
): Promise<MonthlyReport> {
  const [clients, events, done] = await Promise.all([
    buildAdminClientViews(),
    getCalendarEvents(),
    getDoneActions(),
  ]);
  const doneKeys = new Set(done.map((d) => d.key));

  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const quarter = Math.floor(monthIdx / 3); // 0..3
  const qStart = quarter * 3;
  const qEnd = qStart + 2;

  const inMonth = (iso: string | null) => {
    const d = parseISO(iso);
    return !!d && d.getFullYear() === year && d.getMonth() === monthIdx;
  };
  const inQuarter = (iso: string | null) => {
    const d = parseISO(iso);
    return !!d && d.getFullYear() === year && d.getMonth() >= qStart && d.getMonth() <= qEnd;
  };
  const inYTD = (iso: string | null) => {
    const d = parseISO(iso);
    return !!d && d.getFullYear() === year;
  };

  // KPIs + breakdowns
  let mrr = 0;
  let ivaTotal = 0;
  let valuedEngagements = 0;
  const deptMap = new Map<ClientDepartment, DeptStat>();
  const typeMap = new Map<InvoiceType, InvoiceTypeStat>();
  for (const t of INVOICE_TYPES) typeMap.set(t, { type: t, count: 0, value: 0 });

  for (const c of clients) {
    const r = c.record;
    const dept = c.department;
    const ds = deptMap.get(dept) ?? { dept, engagements: 0, mrr: 0 };
    ds.engagements += 1;
    if (r.status === "active" && r.monthlyValue) {
      mrr += r.monthlyValue;
      ds.mrr += r.monthlyValue;
      valuedEngagements += 1;
    }
    deptMap.set(dept, ds);

    if (r.iva) ivaTotal += r.iva;

    const ts = typeMap.get(r.invoiceType);
    if (ts) {
      ts.count += 1;
      ts.value += r.monthlyValue ?? 0;
    }
  }

  const deptOrder: ClientDepartment[] = ["SEO", "ADS", "Web"];
  const byDepartment = deptOrder
    .map((d) => deptMap.get(d))
    .filter((x): x is DeptStat => !!x);

  // Este mês
  const monthRows = clients.filter((c) => inMonth(c.record.invoiceDate));
  const monthEvents = events
    .filter((e) => inMonth(e.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, title: e.title, color: e.color }));
  let invoicesValue = 0;
  let invoicesIva = 0;
  let invoicesSent = 0;
  for (const c of monthRows) {
    invoicesValue += c.record.monthlyValue ?? 0;
    invoicesIva += c.record.iva ?? 0;
    const key = `inv:${c.slug}-${c.department}:${c.record.invoiceDate}`;
    if (doneKeys.has(key)) invoicesSent += 1;
  }

  // Trimestre
  const qNewSlugs = new Set(
    clients.filter((c) => inQuarter(c.record.startingDate)).map((c) => c.slug),
  );
  const qInvoices = clients.filter((c) => inQuarter(c.record.invoiceDate)).length;

  // Desde Janeiro (YTD)
  const ytdNewSlugs = new Set(
    clients.filter((c) => inYTD(c.record.startingDate)).map((c) => c.slug),
  );
  let billedEstimate = 0;
  let ytdIvaEstimate = 0;
  for (const c of clients) {
    const months = monthsActiveYTD(c.record.startingDate, now);
    if (c.record.status === "active" && c.record.monthlyValue) {
      billedEstimate += c.record.monthlyValue * months;
    }
    if (c.record.iva) ytdIvaEstimate += c.record.iva * months;
  }

  const clientRows: ReportClientRow[] = clients
    .map((c) => ({
      slug: c.slug,
      title: c.title,
      department: c.department,
      monthlyValue: c.record.monthlyValue,
      iva: c.record.iva,
      invoiceType: c.record.invoiceType,
      invoiceDate: c.record.invoiceDate,
    }))
    .sort((a, b) => (b.monthlyValue ?? 0) - (a.monthlyValue ?? 0));

  return {
    generatedAtISO: now.toISOString(),
    monthLabel: `${PT_MONTHS[monthIdx]} ${year}`,
    quarterLabel: `T${quarter + 1} ${year}`,
    ytdLabel: `Jan – ${PT_MONTHS[monthIdx].slice(0, 3)} ${year}`,
    clientCount: new Set(clients.map((c) => c.slug)).size,
    engagementCount: clients.length,
    mrr,
    ivaTotal,
    avgTicket: valuedEngagements > 0 ? mrr / valuedEngagements : 0,
    annualRunRate: mrr * 12,
    byDepartment,
    byInvoiceType: INVOICE_TYPES.map((t) => typeMap.get(t)!).filter(Boolean),
    month: {
      invoicesDue: monthRows.length,
      invoicesValue,
      invoicesIva,
      invoicesSent,
      events: monthEvents,
    },
    quarter: {
      newClients: qNewSlugs.size,
      invoicesDue: qInvoices,
      runRate: mrr * 3,
      ivaEstimate: ivaTotal * 3,
    },
    ytd: {
      newClients: ytdNewSlugs.size,
      billedEstimate,
      ivaEstimate: ytdIvaEstimate,
      monthsCovered: monthIdx + 1,
    },
    clients: clientRows,
  };
}
