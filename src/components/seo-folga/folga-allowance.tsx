"use client";

// A folga mensal do projeto — só a direção a muda (v78.37). A mudança vale a
// partir de um mês (o em curso ou um dos dois seguintes): o passado não se
// reescreve, e o registo guarda quem mudou e quando.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { eurCents, folgaMonthName, shiftFolgaMonth, toCents } from "@/lib/seo-folga";

type Props = {
  slug: string;
  nowKey: string;
  current: number | null;
};

export function FolgaAllowanceEditor({ slug, nowKey, current }: Props) {
  const router = useRouter();
  const months = [0, 1, 2].map((d) => shiftFolgaMonth(nowKey, d));
  const [value, setValue] = useState(current === null ? "" : String(current).replace(".", ","));
  const [from, setFrom] = useState(months[1]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const eur = Number(value.replace(",", "."));
  const valid = value.trim() !== "" && Number.isFinite(eur) && eur >= 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/seo/folga/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eur: Math.round(eur * 100) / 100, from }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível guardar.");
      setDone(true);
      window.setTimeout(() => setDone(false), 2500);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold text-white">Folga mensal</h2>
      <p className="mt-1 text-[12.5px] text-white/45">
        Só a direção vê isto. Hoje: {current === null ? "por definir" : eurCents(toCents(current))} por mês.
      </p>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <div className="relative">
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="0,00"
            aria-label="Folga mensal em euros"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 pr-8 text-[14px] tabular-nums text-white focus:border-[#a78bfa]/60 focus:outline-none"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">€</span>
        </div>
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="A partir de"
          className="rounded-xl border border-white/10 bg-[#15121f] px-3 py-2.5 text-[13px] text-white focus:outline-none"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              a partir de {folgaMonthName(m)}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-2 text-[12.5px] text-rose-300">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={!valid || saving}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-white/[0.1] disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : null}
        {done ? "Guardado" : "Guardar folga"}
      </button>
    </section>
  );
}
