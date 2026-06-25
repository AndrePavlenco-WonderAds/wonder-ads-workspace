"use client";

import { useState } from "react";
import { Download } from "lucide-react";

/** Floating "Descarregar PDF" control on the Monthly Report. Sets a
 *  clean document.title (drives the saved-PDF filename) then fires the
 *  browser print dialog. Hidden in the printed output via .no-print. */
export function ReportDownloadButton({ pdfTitle }: { pdfTitle: string }) {
  const [busy, setBusy] = useState(false);
  function download() {
    setBusy(true);
    const prev = document.title;
    document.title = pdfTitle;
    // Restore the title after the print dialog closes.
    const restore = () => {
      document.title = prev;
      setBusy(false);
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    requestAnimationFrame(() => window.print());
    // Safety net if afterprint never fires (some browsers).
    window.setTimeout(restore, 4000);
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="no-print report-download"
    >
      <Download size={16} strokeWidth={2.5} />
      {busy ? "A preparar…" : "Descarregar PDF"}
    </button>
  );
}
