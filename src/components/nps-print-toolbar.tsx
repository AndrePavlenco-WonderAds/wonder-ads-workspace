"use client";

import { useEffect } from "react";
import { Download, X } from "lucide-react";

/** Print toolbar for the NPS answers PDF page. Auto-opens the browser
 *  print dialog on load (so the tab behaves like a "download"), and keeps
 *  a manual re-print + close control. Hidden in the printed output. */
export function NpsPrintToolbar({ title }: { title: string }) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    const id = window.setTimeout(() => window.print(), 500);
    const restore = () => {
      document.title = prev;
    };
    window.addEventListener("afterprint", restore);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", restore);
      document.title = prev;
    };
  }, [title]);

  return (
    <div className="no-print mx-auto mb-6 flex max-w-3xl items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
        style={{
          background:
            "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
        }}
      >
        <Download className="h-4 w-4" />
        Descarregar PDF
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black/55 transition hover:border-black/30 hover:text-black/80"
      >
        <X className="h-4 w-4" />
        Fechar
      </button>
    </div>
  );
}
