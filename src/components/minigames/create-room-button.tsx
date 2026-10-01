"use client";

// Abrir uma sala nova (só SuperAdmin) — escolhe o tempo por ronda e entra.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { ROUND_SECONDS_CHOICES, type RoundSeconds } from "@/lib/minigames/types";

export function CreateRoomButton() {
  const router = useRouter();
  const [seconds, setSeconds] = useState<RoundSeconds>(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/minigames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundSeconds: seconds }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Não foi possível abrir a sala.");
        setBusy(false);
        return;
      }
      router.push(`/minigames/${data.id}`);
    } catch {
      setError("Sem ligação — tenta outra vez.");
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Tempo para adivinhar, por ronda</p>
      <div className="mt-2 inline-flex rounded-2xl border border-white/10 bg-black/25 p-1" role="radiogroup" aria-label="Tempo por ronda">
        {ROUND_SECONDS_CHOICES.map((s) => {
          const on = s === seconds;
          return (
            <button
              key={String(s)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSeconds(s)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                on ? "bg-white text-[#0b0c12] shadow" : "text-white/60 hover:text-white"
              }`}
            >
              {s === null ? "Sem limite" : `${s}s`}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="brand-gradient-bg inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_44px_-14px_rgba(120,61,245,0.95)] transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" fill="currentColor" />}
          Abrir sala
        </button>
        {error && <span className="text-xs text-rose-300">{error}</span>}
      </div>
    </div>
  );
}
