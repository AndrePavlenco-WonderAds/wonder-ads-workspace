"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileBarChart } from "lucide-react";

/** Triggers a monthly-report generation for a period, then navigates to the
 *  report view. `period` omitted → the API defaults to the previous complete
 *  month. Used both to create the first report and to regenerate. */
export function GenerateReportButton({
  slug,
  period,
  label,
  variant = "solid",
}: {
  slug: string;
  period?: string;
  label: string;
  variant?: "solid" | "ghost";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reports/${slug}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(period ? { period } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        period?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.period) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      router.push(`/seo/${slug}/report/${data.period}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
      setBusy(false);
    }
  }

  const base =
    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50";
  const solid =
    "text-white shadow-md shadow-[#783DF5]/25 hover:-translate-y-0.5 hover:brightness-110";
  const ghost =
    "border border-white/15 text-white/75 hover:border-[#783DF5]/50 hover:text-white";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={`${base} ${variant === "solid" ? solid : ghost}`}
        style={
          variant === "solid"
            ? { background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }
            : undefined
        }
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />}
        {busy ? "A gerar…" : label}
      </button>
      {err && <span className="text-[11px] text-rose-400">Não foi possível gerar: {err}</span>}
    </span>
  );
}
