"use client";

// Os preços de referência de cada categoria da Folga de custos (v78.50) — só
// a direção os muda, e valem para todos os projetos. No «Lançar um extra»,
// escolher a categoria preenche o valor com o preço dela; o consultor pode
// mudá-lo. Uma categoria sem preço deixa o valor em branco.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/dates";
import {
  FOLGA_CATEGORIES,
  MAX_FOLGA_PRICE,
  priceInput,
  type FolgaCategory,
  type FolgaPriceList,
  type FolgaPrices,
} from "@/lib/seo-folga";

type Draft = Record<FolgaCategory, string>;

const toDraft = (prices: FolgaPrices) =>
  Object.fromEntries(
    FOLGA_CATEGORIES.map((c) => [c.id, prices[c.id] === undefined ? "" : priceInput(prices[c.id] as number)]),
  ) as Draft;

const parse = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function FolgaPricesEditor({ list }: { list: FolgaPriceList }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => toDraft(list.prices));
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const invalid = FOLGA_CATEGORIES.some((c) => {
    const n = parse(draft[c.id]);
    return n !== null && !(Number.isFinite(n) && n >= 0 && n <= MAX_FOLGA_PRICE);
  });
  const dirty = FOLGA_CATEGORIES.some((c) => parse(draft[c.id]) !== parse(saved[c.id]));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const prices: Record<string, number> = {};
      for (const c of FOLGA_CATEGORIES) {
        const n = parse(draft[c.id]);
        if (n !== null && n > 0) prices[c.id] = Math.round(n * 100) / 100;
      }
      const res = await fetch("/api/seo/folga/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível guardar.");
      const next = toDraft(prices as FolgaPrices);
      setSaved(next);
      setDraft(next);
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
      <h2 className="text-[15px] font-semibold text-white">Preços de referência</h2>
      <p className="mt-1 text-[12.5px] leading-snug text-white/45">
        Só a direção vê isto. Valem para todos os projetos: ao escolher a categoria, o valor do extra preenche-se com este
        preço, e o consultor pode mudá-lo. Em branco, a categoria fica sem preço.
      </p>
      <ul className="mt-4 space-y-1.5">
        {FOLGA_CATEGORIES.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3">
            <label htmlFor={`folga-price-${c.id}`} className="min-w-0 text-[13px] text-white/70">
              {c.label}
            </label>
            <div className="relative w-28 shrink-0">
              <input
                id={`folga-price-${c.id}`}
                inputMode="decimal"
                value={draft[c.id]}
                onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value.replace(/[^\d.,]/g, "") }))}
                placeholder="—"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 pr-7 text-right text-[13px] tabular-nums text-white placeholder:text-white/25 focus:border-[#a78bfa]/60 focus:outline-none"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12.5px] text-white/40">€</span>
            </div>
          </li>
        ))}
      </ul>
      {list.updatedAt > 0 && list.updatedBy && (
        <p className="mt-3 text-[12px] text-white/35">
          Mudados a {formatDate(list.updatedAt)} por {list.updatedBy.name}.
        </p>
      )}
      {error && <p className="mt-2 text-[12.5px] text-rose-300">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={!dirty || invalid || saving}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-white/[0.1] disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : null}
        {done ? "Guardado" : "Guardar preços"}
      </button>
    </section>
  );
}
