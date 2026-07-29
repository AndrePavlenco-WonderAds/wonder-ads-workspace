"use client";

// Curate which position gains reach the client.
//
// Ranking by raw movement surfaces things we don't want in a client's report:
// a competitor's brand name that we happen to rank for, or a term the client
// isn't working (and may not even like). So the app proposes up to 20
// candidates and the consultant picks the 5 that actually tell the story.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, ListChecks, AlertCircle } from "lucide-react";
import type { KeywordMover } from "@/lib/report/report-types";

const MAX_PICKS = 5;

export function ReportMoverPicker({
  slug,
  period,
  candidates,
  selected,
  curated,
}: {
  slug: string;
  period: string;
  candidates: KeywordMover[];
  selected: KeywordMover[];
  curated: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(
    selected.map((m) => m.query),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (candidates.length === 0) return null;

  const atLimit = picked.length >= MAX_PICKS;

  function toggle(query: string) {
    setPicked((cur) =>
      cur.includes(query)
        ? cur.filter((q) => q !== query)
        : cur.length >= MAX_PICKS
          ? cur
          : [...cur, query],
    );
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/reports/${slug}/${period}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movers: picked }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(j?.error ?? "Não foi possível guardar.");
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <ListChecks className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-sm font-semibold text-white/85">
          Subidas de posição a mostrar ao cliente
        </h3>
        <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/60">
          {picked.length}/{MAX_PICKS}
        </span>
        {!curated && (
          <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
            Seleção automática
          </span>
        )}
      </div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-white/50">
        Escolhe até {MAX_PICKS} de {candidates.length} candidatas. As maiores
        subidas incluem muitas vezes{" "}
        <b className="text-white/70">marcas de concorrentes</b> ou termos que o
        cliente não anda a trabalhar — só entra no relatório o que marcares.
      </p>

      <div className="flex flex-col gap-1">
        {candidates.map((m) => {
          const on = picked.includes(m.query);
          return (
            <button
              key={m.query}
              type="button"
              onClick={() => toggle(m.query)}
              disabled={!on && atLimit}
              className={[
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition",
                on
                  ? "border-[#783DF5]/45 bg-[#783DF5]/12"
                  : atLimit
                    ? "border-white/8 bg-white/[0.015] opacity-40"
                    : "border-white/8 bg-white/[0.015] hover:border-white/20",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  on
                    ? "border-[#783DF5] bg-[#783DF5]"
                    : "border-white/25 bg-transparent",
                ].join(" ")}
              >
                {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">
                {m.query}
              </span>
              <span className="shrink-0 font-mono text-[12px] text-white/50">
                pos. {m.position.toFixed(1)}
              </span>
              <span className="shrink-0 font-mono text-[12px] font-semibold text-emerald-300/90">
                ▲ {m.change.toFixed(1)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#783DF5] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#8a52ff] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Guardar seleção
        </button>
        {picked.length === 0 && (
          <span className="text-[12.5px] text-white/45">
            Sem nenhuma escolhida, a secção não aparece no relatório.
          </span>
        )}
        {saved && (
          <span className="text-[12.5px] text-emerald-300/90">Guardado ✓</span>
        )}
        {err && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-red-300/90">
            <AlertCircle className="h-3.5 w-3.5" />
            {err}
          </span>
        )}
      </div>
    </div>
  );
}
