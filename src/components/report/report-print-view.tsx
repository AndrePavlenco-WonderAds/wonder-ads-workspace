// Print/PDF surface for a monthly report. Returned directly from the report
// page when ?print=true — NOT wrapped in PageShell, so browser print captures
// only the branded document (client variant: no pending metrics, no app chrome).
// AutoPrint sets document.title to the spec filename and fires window.print().

import { AutoPrint } from "@/components/auto-print";
import { ReportDocument } from "./report-document";
import type { MonthlyReportSnapshot } from "@/lib/report/report-types";

export function reportPdfFilename(snap: MonthlyReportSnapshot): string {
  const client = snap.clientTitle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Wonderads_SEO-Report_${client}_${snap.period}`;
}

export function ReportPrintView({ snapshot }: { snapshot: MonthlyReportSnapshot }) {
  const filename = reportPdfFilename(snapshot);
  return (
    <html lang={snapshot.lang}>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <title>{filename}</title>
        <meta charSet="utf-8" />
        <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      </head>
      <body>
        <AutoPrint pdfTitle={filename} />
        <div className="wa-print-wrap">
          <ReportDocument snapshot={snapshot} variant="client" />
        </div>
      </body>
    </html>
  );
}

const PRINT_CSS = `
  @page { size: A4; margin: 10mm; }
  @media print {
    *,*::before,*::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .wa-report .wa-sec, .wa-report .wa-two { break-inside: avoid; }
    .wa-report table { break-inside: avoid; }
  }
  html, body { background: #fff !important; margin: 0; padding: 0; }
  .wa-print-wrap { max-width: 190mm; margin: 0 auto; }
  .wa-print-wrap .wa-report {
    box-shadow: none !important; border: none !important; border-radius: 0 !important;
  }
`;
