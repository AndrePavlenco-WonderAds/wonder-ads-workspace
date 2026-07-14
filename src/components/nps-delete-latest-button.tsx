"use client";

// Delete the last NPS submission. Visible to everyone on the NPS page, but
// only the 3 SuperAdmins can actually delete — anyone else who clicks gets
// an inline "Não há permissões suficientes." message (and the server
// enforces it too, so the client flag is only for instant UX).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

export function NpsDeleteLatestButton({
  slug,
  isSuperAdmin,
}: {
  slug: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setMsg(null);
    if (!isSuperAdmin) {
      setMsg("Não há permissões suficientes.");
      return;
    }
    if (
      !window.confirm(
        "Apagar a última avaliação de NPS deste cliente? Esta ação não pode ser anulada.",
      )
    ) {
      return;
    }
    setState("working");
    try {
      const res = await fetch(`/api/nps/${slug}/submission`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(data.error ?? `Erro (${res.status}).`);
        setState("idle");
        return;
      }
      router.refresh();
    } catch {
      setMsg("Falha de rede. Tenta novamente.");
      setState("idle");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[11px] font-medium text-rose-300">{msg}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={state === "working"}
        title="Apagar a última avaliação (apenas SuperAdmins)"
        className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-200 transition hover:border-rose-400/50 hover:bg-rose-500/20 disabled:opacity-50"
      >
        {state === "working" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        Apagar última
      </button>
    </div>
  );
}
