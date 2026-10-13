"use client";

// Os controlos da direção sobre um relatório: a pontuação de 0 a 10 de cada
// ocorrência (com nota). A revisão fecha-se sozinha quando todas estiverem
// pontuadas.
// Cada gravação pede ao servidor e faz router.refresh() — a página volta a
// derivar o estado (PA, NO, nível) com os dados frescos.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { bandOf, MAX_POINTS, SCORE_BANDS, type IneficaciaScore } from "@/lib/ineficacias/shared";

const BAND_BTN: Record<string, { on: string; off: string }> = {
  zero: { on: "border-white/40 bg-white/20 text-white", off: "border-white/10 text-white/50 hover:bg-white/[0.06]" },
  baixo: { on: "border-emerald-300 bg-emerald-400/30 text-white", off: "border-emerald-400/20 text-emerald-200/70 hover:bg-emerald-400/10" },
  medio: { on: "border-amber-300 bg-amber-400/30 text-white", off: "border-amber-400/20 text-amber-200/70 hover:bg-amber-400/10" },
  alto: { on: "border-orange-300 bg-orange-400/30 text-white", off: "border-orange-400/25 text-orange-200/70 hover:bg-orange-400/10" },
  critico: { on: "border-rose-300 bg-rose-500/35 text-white", off: "border-rose-400/25 text-rose-200/70 hover:bg-rose-500/10" },
};

/** O seletor 0–10, com as bandas da escala. */
export function ScorePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (points: number) => void;
  disabled?: boolean;
}) {
  const band = value === null ? null : bandOf(value);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: MAX_POINTS + 1 }, (_, p) => {
          const b = bandOf(p);
          const on = value === p;
          const cls = BAND_BTN[b.id];
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p)}
              aria-pressed={on}
              title={`${p} · ${b.label}`}
              className={`tabular h-8 w-8 rounded-lg border text-[12.5px] font-bold transition disabled:opacity-50 ${on ? cls.on : cls.off}`}
            >
              {p}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-white/45">
        {band ? (
          <>
            <span className="font-semibold text-white/75">{band.label}</span> · {band.hint}
          </>
        ) : (
          SCORE_BANDS.map((b) => `${b.min === b.max ? b.min : `${b.min}–${b.max}`} ${b.label.toLowerCase()}`).join(" · ")
        )}
      </p>
    </div>
  );
}

type Target = { reportId: string; itemId: string } | { username: string; occurrenceId: string };

export function ItemScoreControl({ target, initial }: { target: Target; initial: IneficaciaScore | null }) {
  const router = useRouter();
  const [points, setPoints] = useState<number | null>(initial?.points ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = points !== (initial?.points ?? null) || note !== (initial?.note ?? "");

  async function save() {
    if (points === null) {
      setError("Escolhe a pontuação (0 a 10).");
      return;
    }
    setError(null);
    const res = await fetch("/api/admin/ineficacias/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...target, points, note }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Não foi possível gravar.");
      return;
    }
    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-xl border border-[#783DF5]/25 bg-[#783DF5]/[0.06] p-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#c3aaff]">
        {initial ? "Pontuação da direção" : "Pontuar esta ocorrência"}
      </p>
      <div className="mt-2.5">
        <ScorePicker value={points} onChange={(p) => { setPoints(p); setSaved(false); }} disabled={pending} />
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        maxLength={1000}
        placeholder="Nota (opcional) — o consultor vê-a"
        className="modal-input mt-2.5 w-full text-[12.5px]"
      />
      {error && <p className="mt-2 text-[11.5px] font-semibold text-rose-300">{error}</p>}
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || points === null || (!dirty && Boolean(initial))}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--brand-gradient)" }}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {pending ? "A gravar…" : saved ? "Gravado" : initial ? "Atualizar pontuação" : "Guardar pontuação"}
        </button>
        {initial && !dirty && (
          <span className="text-[11px] text-white/40">Já pontuada — podes corrigir.</span>
        )}
      </div>
    </div>
  );
}
