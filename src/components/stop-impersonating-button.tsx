"use client";

// O botão de saída da faixa. Recarrega a página inteira em vez de um
// router.refresh(): a identidade muda o que TODAS as páginas servem, e
// metade delas são componentes de servidor com cache — um refresh parcial
// deixaria restos da vista anterior.

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

export function StopImpersonatingButton({ realName }: { realName: string }) {
  const [busy, setBusy] = useState(false);

  async function stop() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/impersonate", { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      window.location.reload();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={stop}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-white transition hover:bg-amber-500/30 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ArrowLeft className="h-3 w-3" />
      )}
      Voltar a ser {realName}
    </button>
  );
}
