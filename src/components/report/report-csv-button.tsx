"use client";

// O botão «Exportar CSV» dentro do documento (só na vista interna, v77.95).
// O texto do CSV vem já montado do servidor — aqui só se descarrega. O
// estilo é o `.wa-csv-btn` do documento, que o PDF esconde.

import { downloadCsv } from "./csv-download";

export function ReportCsvButton({
  csv,
  fileName,
  label,
}: {
  csv: string;
  fileName: string;
  label: string;
}) {
  return (
    <button type="button" className="wa-csv-btn" onClick={() => downloadCsv(csv, fileName)}>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      {label}
    </button>
  );
}
