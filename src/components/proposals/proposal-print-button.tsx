"use client";

// Botão «Guardar em PDF» da proposta pública. Abre o diálogo de impressão
// do browser com o título do documento já com o nome da proposta — é o
// nome que o browser sugere para o ficheiro. Só isto precisa de ser client.

import { useState } from "react";
import { Printer } from "lucide-react";

export function ProposalPrintButton({
  docTitle,
  label,
}: {
  docTitle: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  function onClick() {
    setBusy(true);
    const prev = document.title;
    document.title = docTitle;
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => {
        document.title = prev;
        setBusy(false);
      }, 500);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:opacity-70"
      style={{
        background:
          "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
      }}
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
