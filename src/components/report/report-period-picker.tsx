"use client";

// Which month does the consultant want to report?
//
//   • Mês fechado  — the last complete month (the default, unchanged).
//   • Mês em curso — month-to-date, for clients who want July's report on the
//     29th. Windows are cut to the data cutoff and the MoM/YoY comparisons
//     are cut to the SAME number of days, so a 26-day July is compared with a
//     26-day June rather than a full one.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileBarChart, CalendarCheck, CalendarClock } from "lucide-react";

type Option = {
  key: string;
  label: string;
  /** "1–26" for a partial month, null when complete. */
  coverage: string | null;
  alreadyGenerated: boolean;
};

export function ReportPeriodPicker({
  slug,
  closed,
  current,
}: {
  slug: string;
  closed: Option;
  current: Option;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<"closed" | "current">("closed");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const picked = choice === "closed" ? closed : current;

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reports/${slug}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period: picked.key }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        period?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok || !data.period) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      router.push(`/seo/${slug}/report/${data.period}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
      setBusy(false);
    }
  }

  const opts: { id: "closed" | "current"; opt: Option; icon: typeof CalendarCheck; hint: string }[] =
    [
      {
        id: "closed",
        opt: closed,
        icon: CalendarCheck,
        hint: "Mês completo, dados definitivos.",
      },
      {
        id: "current",
        opt: current,
        icon: CalendarClock,
        hint: current.coverage
          ? `Dados de 1 a ${current.coverage.split("–")[1]}. Só números, sem percentagens de variação — um mês incompleto não se compara com um mês inteiro.`
          : "Mês ainda a decorrer.",
      },
    ];

  return (
    <div className="w-full">
      <div className="grid gap-2 sm:grid-cols-2">
        {opts.map(({ id, opt, icon: Icon, hint }) => {
          const on = choice === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setChoice(id)}
              className={[
                "rounded-xl border px-3.5 py-3 text-left transition",
                on
                  ? "border-[#783DF5]/50 bg-[#783DF5]/12"
                  : "border-white/10 bg-white/[0.02] hover:border-white/22",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={`h-4 w-4 shrink-0 ${on ? "text-[#b79bff]" : "text-white/40"}`}
                />
                <span className="text-[13px] font-semibold text-white/90">
                  {opt.label}
                </span>
                {opt.coverage && (
                  <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide text-amber-200/80">
                    parcial
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[11.5px] leading-relaxed text-white/45">
                {hint}
                {opt.alreadyGenerated && " · já gerado"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileBarChart className="h-4 w-4" />
          )}
          {busy
            ? "A gerar…"
            : `${picked.alreadyGenerated ? "Regenerar" : "Gerar"} ${picked.label}`}
        </button>
        {err && (
          <span className="text-[11.5px] text-rose-400">
            Não foi possível gerar: {err}
          </span>
        )}
      </div>
    </div>
  );
}
