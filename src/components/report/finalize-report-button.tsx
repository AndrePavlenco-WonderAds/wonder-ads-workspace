"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket, CheckCircle2 } from "lucide-react";

/** Explicit "Finalizar report" action. Only after this does the report announce
 *  to #client-wins and unlock its client-facing actions. Re-runnable: a report
 *  already finalised shows a "Voltar a finalizar" affordance that re-announces
 *  (e.g. after a regeneration with fresh numbers). */
export function FinalizeReportButton({
  slug,
  period,
  finalized,
}: {
  slug: string;
  period: string;
  finalized: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<string[] | null>(null);
  const [announced, setAnnounced] = useState<boolean | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setPending(null);
    setAnnounced(null);
    try {
      const res = await fetch(`/api/reports/${slug}/${period}/finalize`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        announced?: boolean;
        error?: string;
        pending?: string[];
      };
      if (res.status === 400 && data.error === "incomplete") {
        setPending(data.pending ?? []);
        return;
      }
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setAnnounced(Boolean(data.announced));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
          finalized
            ? "border border-white/15 text-white/75 hover:border-[#783DF5]/50 hover:text-white"
            : "text-white shadow-md shadow-[#783DF5]/25 hover:-translate-y-0.5 hover:brightness-110"
        }`}
        style={
          finalized
            ? undefined
            : { background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }
        }
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        {busy
          ? "A finalizar…"
          : finalized
            ? "Voltar a finalizar e reanunciar"
            : "Finalizar report"}
      </button>

      {announced === true && !busy && (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Anunciado no #client-wins ✓
        </span>
      )}
      {announced === false && !busy && (
        <span className="text-[12px] text-white/45">
          Finalizado. (Aviso ao Slack por configurar — falta
          {" "}
          <code className="rounded bg-white/10 px-1">SLACK_CLIENT_WINS_WEBHOOK_URL</code>.)
        </span>
      )}
      {pending && (
        <span className="text-[12px] text-amber-300">
          Faltam dados por preencher/marcar N/A:{" "}
          {pending.length ? pending.join(", ") : "métricas em falta"}.
        </span>
      )}
      {err && (
        <span className="text-[12px] text-rose-400">
          Não foi possível finalizar: {err}
        </span>
      )}
    </div>
  );
}
